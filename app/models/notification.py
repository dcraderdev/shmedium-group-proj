from .db import db, environment, SCHEMA, add_prefix_for_prod
from datetime import datetime


class Notification(db.Model):
    __tablename__ = 'notifications'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('users.id')), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('users.id')), nullable=False)
    target_type = db.Column(db.String(20))
    target_id = db.Column(db.Integer)
    read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    recipient = db.relationship('User', foreign_keys=[user_id], backref='notifications')
    actor = db.relationship('User', foreign_keys=[actor_id])

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'type': self.type,
            'actorId': self.actor_id,
            'actorName': f"{self.actor.first_name} {self.actor.last_name}",
            'actorUsername': self.actor.username,
            'actorImage': self.actor.profile_image,
            'targetType': self.target_type,
            'targetId': self.target_id,
            'read': self.read,
            'createdAt': self.created_at,
        }
