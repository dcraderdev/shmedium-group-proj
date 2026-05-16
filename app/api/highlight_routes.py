from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app.models import db, Story, StoryHighlight

highlight_routes = Blueprint('highlights', __name__)


def _build_highlight_map(story_id):
    rows = StoryHighlight.query.filter_by(story_id=story_id).all()
    counts = {}
    for row in rows:
        counts[row.text] = counts.get(row.text, 0) + 1
    return [{'text': t, 'count': c} for t, c in counts.items()]


@highlight_routes.route('/<int:story_id>/highlights', methods=['GET'])
def get_highlights(story_id):
    return jsonify({'highlights': _build_highlight_map(story_id)})


@highlight_routes.route('/<int:story_id>/highlight', methods=['POST'])
@login_required
def create_highlight(story_id):
    data = request.get_json() or {}
    text = data.get('text', '').strip()

    if not text or len(text) > 1000:
        return {"error": "Invalid text — must be 1–1000 characters"}, 400

    story = Story.query.get(story_id)
    if not story:
        return {"error": "Story not found"}, 404

    existing = StoryHighlight.query.filter_by(
        user_id=current_user.id, story_id=story_id, text=text
    ).first()
    if existing:
        return {"error": "Already clipped"}, 400

    highlight = StoryHighlight(user_id=current_user.id, story_id=story_id, text=text)
    db.session.add(highlight)
    db.session.commit()

    return jsonify({
        'id': highlight.id,
        'highlights': _build_highlight_map(story_id),
    }), 201


@highlight_routes.route('/highlight/<int:highlight_id>', methods=['DELETE'])
@login_required
def delete_highlight(highlight_id):
    highlight = StoryHighlight.query.get(highlight_id)
    if not highlight:
        return {"error": "Highlight not found"}, 404
    if highlight.user_id != current_user.id:
        return {"error": "Forbidden"}, 403

    story_id = highlight.story_id
    db.session.delete(highlight)
    db.session.commit()

    return jsonify({'highlights': _build_highlight_map(story_id)})
