from .db import db, environment, SCHEMA, add_prefix_for_prod

class Follower(db.Model):
    __tablename__ = 'followers'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    follower_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('users.id')), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('users.id')), nullable=False)

    follower_user = db.relationship('User', back_populates='following', foreign_keys=[follower_id])
    author_user = db.relationship('User', back_populates='followers', foreign_keys=[author_id])

    def to_dict(self):
        return {
            'id': self.id,
            'followerId': self.follower_id,
            'authorId': self.author_id,
            'followerUser': _user_stub(self.follower_user),
            'authorUser': _user_stub(self.author_user),
        }


def _user_stub(user):
    if user is None:
        return None
    return {
        'id': user.id,
        'firstName': user.first_name,
        'lastName': user.last_name,
        'profileImage': user.profile_image,
    }