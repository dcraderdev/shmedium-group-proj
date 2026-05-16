from flask import Blueprint, request
from flask_login import login_required, current_user
from app.models import db, Story, Comment, CommentClap
from datetime import datetime, timedelta
from sqlalchemy.orm import joinedload, selectinload

comment_routes = Blueprint('comments', __name__)

EDIT_WINDOW_MINUTES = 5


def _story_eager(story_id):
    """Return a single story with all relations needed by to_dict()."""
    from ..models.user import User
    from ..models.story_tag import StoryTag
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
    ).get(story_id)


def _comment_eager(comment_id):
    return Comment.query.options(
        joinedload(Comment.user),
        selectinload(Comment.claps),
        selectinload(Comment.replies).options(
            joinedload(Comment.user),
            selectinload(Comment.claps),
        ),
    ).get(comment_id)


@comment_routes.route('/<int:id>')
def get_comment(id):
    comment = _comment_eager(id)
    if comment is None:
        return {'error': 'Comment not found'}, 404
    return comment.to_dict()


@comment_routes.route('/<int:id>', methods=['POST'])
@login_required
def create_comment(id):
    """Create a top-level comment on story <id>."""
    data = request.get_json()
    if not data or not data.get('content', '').strip():
        return {'error': 'content is required'}, 422

    comment = Comment(
        user_id=current_user.id,
        story_id=id,
        content=data['content'].strip(),
    )
    db.session.add(comment)
    db.session.commit()
    return _story_eager(id).to_dict()


@comment_routes.route('/<int:id>/reply', methods=['POST'])
@login_required
def create_reply(id):
    """Create a reply to top-level comment <id>."""
    parent = Comment.query.get(id)
    if parent is None:
        return {'error': 'Comment not found'}, 404
    if parent.parent_id is not None:
        return {'error': 'Cannot reply to a reply'}, 400

    data = request.get_json()
    if not data or not data.get('content', '').strip():
        return {'error': 'content is required'}, 422

    reply = Comment(
        user_id=current_user.id,
        story_id=parent.story_id,
        parent_id=id,
        content=data['content'].strip(),
    )
    db.session.add(reply)
    db.session.commit()
    return _story_eager(parent.story_id).to_dict()


@comment_routes.route('/<int:id>', methods=['PUT'])
@login_required
def update_comment(id):
    comment = Comment.query.get(id)
    if comment is None:
        return {'error': 'Comment not found'}, 404
    if current_user.id != comment.user_id:
        return {'error': 'Forbidden'}, 403

    age = datetime.utcnow() - comment.created_at
    if age > timedelta(minutes=EDIT_WINDOW_MINUTES):
        return {'error': f'Comments can only be edited within {EDIT_WINDOW_MINUTES} minutes of posting'}, 403

    data = request.get_json()
    if not data or not data.get('content', '').strip():
        return {'error': 'content is required'}, 422

    comment.content = data['content'].strip()
    db.session.commit()
    return _story_eager(comment.story_id).to_dict()


@comment_routes.route('/<int:id>', methods=['DELETE'])
@login_required
def delete_comment(id):
    comment = Comment.query.get(id)
    if comment is None:
        return {'error': 'Comment not found'}, 404
    if current_user.id != comment.user_id:
        return {'error': 'Forbidden'}, 403

    story_id = comment.story_id
    db.session.delete(comment)
    db.session.commit()
    return _story_eager(story_id).to_dict()


@comment_routes.route('/<int:id>/clap', methods=['POST'])
@login_required
def create_comment_clap(id):
    comment = Comment.query.get(id)
    if comment is None:
        return {'error': 'Comment not found'}, 404
    if comment.user_id == current_user.id:
        return {'error': 'Cannot clap your own comment'}, 403

    existing = CommentClap.query.filter_by(user_id=current_user.id, comment_id=id).first()
    if existing:
        return {'error': 'Already clapped'}, 403

    db.session.add(CommentClap(user_id=current_user.id, comment_id=id))
    db.session.commit()
    return _story_eager(comment.story_id).to_dict()


@comment_routes.route('/<int:id>/clap', methods=['DELETE'])
@login_required
def delete_comment_clap(id):
    comment = Comment.query.get(id)
    if comment is None:
        return {'error': 'Comment not found'}, 404

    clap = CommentClap.query.filter_by(user_id=current_user.id, comment_id=id).first()
    if clap is None:
        return {'error': 'No clap to remove'}, 403

    db.session.delete(clap)
    db.session.commit()
    return _story_eager(comment.story_id).to_dict()
