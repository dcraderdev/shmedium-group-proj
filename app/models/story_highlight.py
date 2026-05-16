from .db import db, environment, SCHEMA, add_prefix_for_prod
from datetime import datetime


class StoryHighlight(db.Model):
    __tablename__ = 'story_highlights'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('users.id')), nullable=False)
    story_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('stories.id')), nullable=False)
    text = db.Column(db.String(1000), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', back_populates='highlights')
    story = db.relationship('Story', back_populates='highlights')

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'storyId': self.story_id,
            'text': self.text,
            'createdAt': self.created_at,
        }
