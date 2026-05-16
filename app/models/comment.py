from .db import db, environment, SCHEMA, add_prefix_for_prod
from datetime import datetime

class Comment(db.Model):
    __tablename__ = 'comments'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('users.id')), nullable=False)
    story_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('stories.id')), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('comments.id'), ondelete='CASCADE'), nullable=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', back_populates='comments')
    story = db.relationship('Story', back_populates='comments')
    claps = db.relationship('CommentClap', back_populates='comment', cascade='all, delete-orphan')
    replies = db.relationship(
        'Comment',
        backref=db.backref('parent', remote_side=[id]),
        cascade='all, delete-orphan',
        foreign_keys='Comment.parent_id',
    )

    def to_dict(self, include_replies=True):
        data = {
            'id': self.id,
            'userId': self.user_id,
            'storyId': self.story_id,
            'parentId': self.parent_id,
            'content': self.content,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at,
            'author': {
                'id': self.user_id,
                'firstName': self.user.first_name,
                'lastName': self.user.last_name,
                'profileImage': self.user.profile_image,
            },
            'clapCount': len(self.claps),
        }
        if include_replies:
            data['replies'] = [r.to_dict(include_replies=False) for r in self.replies]
        return data