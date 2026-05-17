from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.models import db, Story, Tag, StoryImage, StoryTag, Comment, User, Clap, Follower, Bookmark
from app.forms import StoryForm
from app.forms import StoryImageForm
from sqlalchemy.orm import joinedload, selectinload
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime

from ..aws3 import s3, bucket, region, generate_image_variants
import boto3
from .notification_helpers import create_notification, notify_mentions


story_routes = Blueprint('stories', __name__)


def _notify_co_commenters(story, actor_id):
    """Notify other people who commented on a story that there's a new reply."""
    seen = set()
    for comment in story.comments:
        uid = comment.user_id
        if uid != actor_id and uid != story.author_id and uid not in seen:
            create_notification(uid, 'reply', actor_id, 'story', story.id)
            seen.add(uid)


def _story_with_relations():
    """Base Story query with every relation that to_dict() touches eager-loaded.

    Collapses the N+1 chain (author + author.followers/following, tags->tag,
    images, comments->user+claps, claps) into a small constant number of
    SELECTs regardless of story count.
    """
    from app.models import StoryHighlight
    return Story.query.options(
        selectinload(Story.author).options(
            selectinload(User.followers),
            selectinload(User.following),
        ),
        selectinload(Story.tags).joinedload(StoryTag.tag),
        selectinload(Story.images),
        selectinload(Story.comments).options(
            joinedload(Comment.user),
            selectinload(Comment.claps),
            selectinload(Comment.replies).options(
                joinedload(Comment.user),
                selectinload(Comment.claps),
            ),
        ),
        selectinload(Story.claps),
        selectinload(Story.bookmarks),
        selectinload(Story.highlights),
    )


@story_routes.route('/')
def stories():
    stories = _story_with_relations().filter(Story.is_published == True).all()
    return {'stories': [story.to_dict() for story in stories]}



@story_routes.route('/initialize')
def initial_load():
    stories = _story_with_relations().filter(Story.is_published == True).all()
    tags = Tag.query.all()
    return {
        'stories': [story.to_dict() for story in stories],
        'tags': [tag.tag for tag in tags],
    }




@story_routes.route('/curr')
@login_required
def curr_user_stories():
    stories = _story_with_relations().filter(
        Story.author_id == current_user.id,
        Story.is_published == True,
    ).all()
    if stories is None:
        return {"error": "No stories found"}, 404
    return {'stories': [story.to_dict() for story in stories]}


@story_routes.route('/drafts')
@login_required
def get_drafts():
    """Return current user's unpublished drafts (lightweight, no comments eager-loaded)."""
    drafts = (
        Story.query
        .filter(Story.author_id == current_user.id, Story.is_published == False)
        .order_by(Story.updated_at.desc())
        .all()
    )
    return {'drafts': [
        {
            'id': d.id,
            'title': d.title or 'Untitled',
            'slicedIntro': d.sliced_intro or '',
            'updatedAt': d.updated_at.isoformat() if d.updated_at else None,
            'createdAt': d.created_at.isoformat() if d.created_at else None,
            'wordCount': len([w for w in (d.content or '').split() if w]),
        }
        for d in drafts
    ]}


@story_routes.route('/draft', methods=['POST'])
@login_required
def create_draft():
    """Create an empty draft and return its id."""
    draft = Story(
        author_id=current_user.id,
        title='',
        content='',
        is_published=False,
    )
    db.session.add(draft)
    db.session.commit()
    return jsonify({'id': draft.id, 'isPublished': False})


@story_routes.route('/<int:id>/autosave', methods=['PATCH'])
@login_required
def autosave_story(id):
    """Save title + content without publishing. Returns {savedAt}."""
    story = Story.query.get(id)
    if story is None:
        return {'error': 'Story not found'}, 404
    if story.author_id != current_user.id:
        return {'error': 'Forbidden'}, 403

    data = request.get_json() or {}
    if 'title' in data:
        story.title = data['title']
    if 'content' in data:
        story.content = data['content'][:6000]
    story.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'savedAt': story.updated_at.isoformat()})


@story_routes.route('/<int:id>/publish', methods=['POST'])
@login_required
def publish_draft(id):
    """Publish a draft: accept multipart/form with title, content, tags, images, summary."""
    story = _story_with_relations().filter(Story.id == id).first()
    if story is None:
        return {'error': 'Story not found'}, 404
    if story.author_id != current_user.id:
        return {'error': 'Forbidden'}, 403

    title = request.form.get('title', story.title or '').strip()
    content = request.form.get('content', story.content or '')[:6000]
    sliced_intro = request.form.get('slicedIntro') or content[:130] + '...'
    tags_raw = request.form.getlist('tags')

    story.title = title
    story.content = content
    story.sliced_intro = sliced_intro
    story.is_published = True
    story.updated_at = datetime.utcnow()

    # Replace tags — accepts either tag IDs (int strings) or tag names
    StoryTag.query.filter_by(story_id=story.id).delete()
    for tag_val in tags_raw:
        tag_val = tag_val.strip()
        if not tag_val:
            continue
        try:
            tag_id = int(tag_val)
            db.session.add(StoryTag(story_id=story.id, tag_id=tag_id))
        except ValueError:
            # It's a name, look up or create
            tag_obj = Tag.query.filter_by(tag=tag_val).first()
            if tag_obj:
                db.session.add(StoryTag(story_id=story.id, tag_id=tag_obj.id))

    # Handle new images
    files = request.files.getlist('images')
    for i, file in enumerate(files):
        if not file or file.filename == '':
            continue
        filename = secure_filename(file.filename)
        file.save(filename)
        s3.upload_file(Bucket=bucket, Filename=filename, Key=filename)
        url = f"https://{bucket}.s3.{region}.amazonaws.com/{filename}"
        has_variants = False
        try:
            with open(filename, 'rb') as fh:
                generate_image_variants(fh.read(), filename)
            has_variants = True
        except Exception:
            pass
        finally:
            try:
                os.remove(filename)
            except Exception:
                pass
        position = int(request.form.get(f'position{i}', 0))
        alt_tag = request.form.get(f'altTag{i}', '')
        db.session.add(StoryImage(
            story_id=story.id, url=url, file_name=filename,
            has_variants=has_variants, position=position, alt_tag=alt_tag,
        ))

    db.session.commit()
    return _story_with_relations().filter(Story.id == id).first().to_dict()




@story_routes.route('/subscribed')
@login_required
def subscribed_stories():
    followings = Follower.query.filter_by(follower_id=current_user.id).all()
    followed_authors_ids = [following.author_id for following in followings]
    subscribed_stories = _story_with_relations().filter(
        Story.author_id.in_(followed_authors_ids),
        Story.is_published == True,
    ).all()
    if subscribed_stories is None:
        return {"error": "No stories found"}, 404
    return {'subscribedStories': [story.to_dict() for story in subscribed_stories]}






@story_routes.route('/<int:id>')
def story(id):
    """
    Query for a story by id and returns that story in a dictionary
    """
    story = _story_with_relations().filter(Story.id == id).first()

    if story is None:
        return {"error": "Story not found"}, 404
    
    #we need to check if current user has clapped this story if we want to hide Unclap button
    has_clapped = False
    if current_user.is_authenticated:
        has_clapped = Clap.query.filter_by(user_id=current_user.id, story_id=story.id).first() is not None

    has_bookmarked = False
    if current_user.is_authenticated:
        has_bookmarked = Bookmark.query.filter_by(
            user_id=current_user.id, story_id=story.id
        ).first() is not None

    story_dict = story.to_dict()
    story_dict['hasClapped'] = has_clapped
    story_dict['hasBookmarked'] = has_bookmarked
    return story_dict



@story_routes.route('/<int:id>', methods=['DELETE'])
@login_required
def delete_story(id):
    """
    Deletes a story by id
    """
    story = Story.query.get(id)
    if story is None:
        return {"error": "Story not found"}, 404
    if current_user.id != story.author_id:
        return {"error": "You do not have permission to edit this story"}, 403

    db.session.delete(story)
    db.session.commit()
    return {"message": "Story deleted successfully"}, 201



@story_routes.route('/<int:id>/image', methods=['POST'])
@login_required
def create_story_image(id):
    """
    Creates a new story image attached to an existing story.
    Expects a file under the 'images' or 'file' key plus form fields:
    position (int) and alt_tag (str).
    """
    story = Story.query.get(id)
    if story is None:
        return {"error": "Story not found"}, 404
    if current_user.id != story.author_id:
        return {"error": "You do not have permission to edit this story"}, 403

    # Determine the uploaded file
    file = None
    if 'images' in request.files:
        files = request.files.getlist('images')
        if files:
            file = files[0]
    if file is None and 'file' in request.files:
        file = request.files['file']

    if file is None or file.filename == '':
        return {"error": "No file selected"}, 400

    filename = secure_filename(file.filename)
    file.save(filename)
    s3.upload_file(Bucket=bucket, Filename=filename, Key=filename)
    url = f"https://{bucket}.s3.{region}.amazonaws.com/{filename}"

    has_variants = False
    try:
        with open(filename, 'rb') as fh:
            result = generate_image_variants(fh.read(), filename)
        has_variants = result is True
    except Exception as e:
        print(f"Warning: variant generation failed for {filename}: {e}")
    finally:
        try:
            os.remove(filename)
        except Exception:
            pass

    position = request.form.get('position')
    alt_tag = request.form.get('alt_tag', '')

    if not position:
        return {"error": "position is required"}, 400

    new_story_image = StoryImage(
        story_id=story.id,
        url=url,
        file_name=filename,
        has_variants=has_variants,
        position=int(position),
        alt_tag=alt_tag,
    )
    db.session.add(new_story_image)
    db.session.commit()
    return jsonify({**new_story_image.to_dict(), 'message': 'Story image successfully created'}), 201


@story_routes.route('/', methods=['POST'])
@login_required
def create_story():
    """
    Creates a new story
    """

    form = StoryForm()
    form['csrf_token'].data = request.cookies['csrf_token']
    if not form.validate_on_submit(): 

      print(form.errors)

    if form.validate_on_submit():
      data = form.data
      new_story = Story(
          author_id=current_user.id,
          title=data['title'],
          content=data['content']
      )
      db.session.add(new_story)
      db.session.commit()
      return new_story.to_dict()

    if form.errors:
      return "Bad Data"


@story_routes.route('/<int:id>', methods=['PUT'])
@login_required
def update_story(id):
    form = StoryForm()
    form['csrf_token'].data = request.cookies['csrf_token']
    
    if form.validate_on_submit():
        data = form.data
        story = Story.query.get(id)

        if story is None:
            return {"error": "Story not found"}, 404
        if current_user.id != story.author_id:
            return {"error": "You do not have permission to edit this story"}, 403


        images_to_update = json.loads(request.form.get('imagesToUpdate')) 
        print(images_to_update)


        id_to_position = {int(id): int(img['position']) for id, img in images_to_update.items()}

        existing_images = StoryImage.query.filter_by(story_id=story.id).all()

        for img in existing_images:
            if img.id in id_to_position:
                img.position = id_to_position[img.id]

        files = request.files.getlist('images')

        for i, file in enumerate(files):
            if file.filename == '':
                return {"error": "No file selected"}, 400

            filename = secure_filename(file.filename)
            file.save(filename)
            s3.upload_file(Bucket=bucket, Filename=filename, Key=filename)
            url = f"https://{bucket}.s3.{region}.amazonaws.com/{filename}"

            has_variants = False
            try:
                with open(filename, 'rb') as fh:
                    generate_image_variants(fh.read(), filename)
                has_variants = True
            except Exception as e:
                print(f"Warning: variant generation failed for {filename}: {e}")

            new_story_image = StoryImage(
                story_id=story.id,
                url=url,
                file_name=filename,
                has_variants=has_variants,
                position=request.form.get(f'position{i}'),
                alt_tag=request.form.get(f'altTag{i}')
            )
            db.session.add(new_story_image)
            try:
                os.remove(filename)
            except Exception as e:
                print(f"Error occurred while deleting file: {e}")


        db.session.commit()

        story.title = data['title']
        story.content = data['content']
        db.session.commit()

        return story.to_dict()

    else:
        return {"error": "Bad Data"}, 400





@story_routes.route('/create', methods=['POST'])
@login_required
def create_story_with_images():
    """
    Creates a new story with included images
    """

    form = StoryForm()
    form['csrf_token'].data = request.cookies['csrf_token']
    
    if form.validate_on_submit():
        data = form.data
        new_story = Story(
            author_id=current_user.id,
            title=data['title'],
            content=request.form.get('content'),
            time_to_read=request.form.get('time_to_read'),
            sliced_intro=request.form.get('sliced_intro'),
        )
        db.session.add(new_story)
        db.session.commit()

        # Handle story images
        files = request.files.getlist('images')

        for i, file in enumerate(files):
            if file.filename == '':
                return {"error": "No file selected"}, 400

            filename = secure_filename(file.filename)
            file.save(filename)
            s3.upload_file(
                Bucket=bucket,
                Filename=filename,
                Key=filename
            )
            url = f"https://{bucket}.s3.{region}.amazonaws.com/{filename}"

            has_variants = False
            try:
                with open(filename, 'rb') as fh:
                    generate_image_variants(fh.read(), filename)
                has_variants = True
            except Exception as e:
                print(f"Warning: variant generation failed for {filename}: {e}")

            alt_tag = request.form.get(f'altTag{i}')
            position = request.form.get(f'position{i}')

            new_story_image = StoryImage(
                story_id=new_story.id,
                url=url,
                file_name=filename,
                has_variants=has_variants,
                position=position,
                alt_tag=alt_tag
            )
            db.session.add(new_story_image)
            db.session.commit()
            try:
                os.remove(filename)
            except Exception as e:
                print(f"Error occurred while deleting file: {e}")

        # Handle story tags
        tags = request.form.getlist('tags')
        for tag in tags:
            new_story_tag = StoryTag(
                story_id=new_story.id,
                tag_id=tag
            )
            db.session.add(new_story_tag)
            db.session.commit()

        return new_story.to_dict()
    else:
        print(form.errors)

    return {"error": "Bad Data"}







@story_routes.route('/<int:id>/comment', methods=['POST'])
@login_required
def create_comment(id):
    """Create a top-level comment on a story."""
    data = request.get_json()
    if not data or not data.get('content', '').strip():
        return {'error': 'content is required'}, 422

    story = _story_with_relations().filter(Story.id == id).first()
    if story is None:
        return {'error': 'Story not found'}, 404

    already = any(c.user_id == current_user.id for c in story.comments if c.parent_id is None)
    if already:
        return {'error': 'You have already commented on this story'}, 403

    new_comment = Comment(
        user_id=current_user.id,
        story_id=id,
        content=data['content'].strip(),
    )
    db.session.add(new_comment)
    db.session.commit()
    create_notification(story.author_id, 'comment', current_user.id, 'story', id)
    notify_mentions(data['content'], current_user.id, id)
    _notify_co_commenters(story, current_user.id)
    return _story_with_relations().filter(Story.id == id).first().to_dict()



@story_routes.route('/feed')
@login_required
def feed():
    """
    GET - FEED OF STORIES FOR CURR USER
    """

    following_list = [author.author_id for author in current_user.following]

    stories = Story.query.filter(Story.author_id.in_(following_list)).all()

    feed_data = []
    for story in stories:
        feed_data.append({
            'story_id': story.id,
            'title': story.title,
            'content': story.content,
            'author': {
                'author_id': story.author.id,
                'author_name': story.author.first_name
            }
        })
    print(len(feed_data))

    return jsonify({'feed': feed_data}), 200




@story_routes.route('/<int:id>/clap', methods=['POST'])
@login_required
def create_clap(id):
    """
    Creates a new clap on a story
    """

    story = Story.query.get(id)
    if story is None:
        return {"error": "Story not found"}, 404
    if story.author_id == current_user.id:
        return {"error": "Cannot clap own story"}, 400
            

    new_clap = Clap(
        user_id=current_user.id,
        story_id=id,
    )

    db.session.add(new_clap)
    db.session.commit()
    create_notification(story.author_id, 'clap', current_user.id, 'story', id)
    db.session.commit()

    return story.to_dict()



@story_routes.route('/<int:id>/related')
def related_stories(id):
    """Return up to 3 stories by same author and up to 3 stories sharing a tag."""
    story = _story_with_relations().filter(Story.id == id).first()
    if not story:
        return {"error": "Story not found"}, 404

    by_author = (
        _story_with_relations()
        .filter(Story.author_id == story.author_id, Story.id != id)
        .order_by(Story.created_at.desc())
        .limit(3)
        .all()
    )

    tag_ids = [st.tag_id for st in story.tags]
    by_tag = []
    if tag_ids:
        tag_story_ids = (
            db.session.query(StoryTag.story_id)
            .filter(StoryTag.tag_id.in_(tag_ids), StoryTag.story_id != id)
            .distinct()
            .limit(20)
            .all()
        )
        tag_story_ids = [r[0] for r in tag_story_ids]
        by_tag = (
            _story_with_relations()
            .filter(Story.id.in_(tag_story_ids), Story.author_id != story.author_id)
            .order_by(Story.created_at.desc())
            .limit(3)
            .all()
        )

    return {
        'byAuthor': [s.to_dict() for s in by_author],
        'byTag': [s.to_dict() for s in by_tag],
    }


@story_routes.route('/<int:id>/clap', methods=['DELETE'])
@login_required
def remove_clap(id):
    """
    Removes a clap on a story
    """

    story = Story.query.get(id)
    if story is None:
        return {"error": "Story not found"}, 404
    if story.author_id == current_user.id:
        return {"error": "Cannot remove clap from own story"}, 400

    clap_to_remove = Clap.query.filter_by(user_id=current_user.id, story_id=id).first()
    if clap_to_remove is None:
        return {"message": "No claps found"}, 400

    db.session.delete(clap_to_remove)
    db.session.commit()

    has_clapped = Clap.query.filter_by(user_id=current_user.id, story_id=id).first() is not None

    return story.to_dict()
