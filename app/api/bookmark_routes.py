from flask import Blueprint, jsonify
from flask_login import login_required, current_user
from app.models import db, Story, Bookmark

bookmark_routes = Blueprint('bookmarks', __name__)


@bookmark_routes.route('/<int:story_id>/bookmark', methods=['POST'])
@login_required
def create_bookmark(story_id):
    story = Story.query.get(story_id)
    if not story:
        return {"error": "Story not found"}, 404

    existing = Bookmark.query.filter_by(user_id=current_user.id, story_id=story_id).first()
    if existing:
        return {"error": "Already bookmarked"}, 400

    bookmark = Bookmark(user_id=current_user.id, story_id=story_id)
    db.session.add(bookmark)
    db.session.commit()

    return jsonify({
        'hasBookmarked': True,
        'bookmarkCount': len(story.bookmarks),
    }), 201


@bookmark_routes.route('/<int:story_id>/bookmark', methods=['DELETE'])
@login_required
def delete_bookmark(story_id):
    bookmark = Bookmark.query.filter_by(user_id=current_user.id, story_id=story_id).first()
    if not bookmark:
        return {"error": "Bookmark not found"}, 404

    db.session.delete(bookmark)
    db.session.commit()

    story = Story.query.get(story_id)
    return jsonify({
        'hasBookmarked': False,
        'bookmarkCount': len(story.bookmarks),
    }), 200
