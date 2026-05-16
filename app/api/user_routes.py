from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app.models import db, User, Story, Clap, Follower
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import os

from ..aws3 import s3, bucket, region
from ..models.comment import Comment
from ..models.story_tag import StoryTag

user_routes = Blueprint('users', __name__)

PER_PAGE = 12


def _author_stories_query(user_id):
    from ..models.story_image import StoryImage
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
    ).filter(Story.author_id == user_id)


@user_routes.route('/')
@login_required
def users():
    users = User.query.all()
    return {'users': [user.to_dict() for user in users]}


@user_routes.route('/<int:id>')
def user(id):
    user = User.query.options(
        selectinload(User.followers),
        selectinload(User.following),
    ).get(id)
    if not user:
        return {'error': 'User not found'}, 404
    return user.to_dict()


@user_routes.route('/curr')
@login_required
def curr_user():
    user = User.query.options(
        selectinload(User.followers),
        selectinload(User.following),
    ).get(current_user.id)
    return user.to_dict()


@user_routes.route('/<int:id>/profile')
def author_profile(id):
    """Public author profile with story stats."""
    user = User.query.options(
        selectinload(User.followers),
        selectinload(User.following),
    ).get(id)
    if not user:
        return {'error': 'User not found'}, 404

    total_stories = Story.query.filter_by(author_id=id).count()
    total_claps = db.session.query(func.count(Clap.id)).join(Story).filter(Story.author_id == id).scalar() or 0

    profile = user.to_dict()
    profile['totalStories'] = total_stories
    profile['totalClaps'] = total_claps
    return profile


@user_routes.route('/<int:id>/stories')
def author_stories(id):
    """Paginated stories for an author. sort=newest|top"""
    user = User.query.get(id)
    if not user:
        return {'error': 'User not found'}, 404

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', PER_PAGE, type=int)
    sort = request.args.get('sort', 'newest')

    q = _author_stories_query(id)

    if sort == 'top':
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        clap_subq = (
            db.session.query(Clap.story_id, func.count(Clap.id).label('clap_count'))
            .filter(Clap.created_at >= month_start)
            .group_by(Clap.story_id)
            .subquery()
        )
        q = (
            q.outerjoin(clap_subq, Story.id == clap_subq.c.story_id)
            .order_by(func.coalesce(clap_subq.c.clap_count, 0).desc(), Story.created_at.desc())
        )
    else:
        q = q.order_by(Story.created_at.desc())

    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    return {
        'stories': [s.to_dict() for s in pagination.items],
        'totalPages': pagination.pages,
        'currentPage': page,
        'totalStories': pagination.total,
    }


@user_routes.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update current user profile: bio, social links, cover image."""
    data = request.form if request.content_type and 'multipart' in request.content_type else request.get_json() or {}

    user = User.query.get(current_user.id)

    if 'bio' in data:
        user.bio = data['bio'] or None
    if 'twitterHandle' in data:
        user.twitter_handle = data['twitterHandle'] or None
    if 'githubHandle' in data:
        user.github_handle = data['githubHandle'] or None
    if 'websiteUrl' in data:
        user.website_url = data['websiteUrl'] or None

    cover_file = request.files.get('coverImage') if hasattr(request, 'files') else None
    if cover_file and cover_file.filename:
        filename = secure_filename(cover_file.filename)
        key = f"covers/{current_user.id}/{filename}"
        s3.upload_fileobj(cover_file, bucket, key, ExtraArgs={'ContentType': cover_file.content_type})
        url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        user.cover_image_url = url
    elif 'coverImageUrl' in data and data['coverImageUrl']:
        user.cover_image_url = data['coverImageUrl']

    db.session.commit()
    return User.query.options(
        selectinload(User.followers),
        selectinload(User.following),
    ).get(current_user.id).to_dict()
