from .db import db, environment, SCHEMA, add_prefix_for_prod
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from datetime import datetime
from sqlalchemy import Column, DateTime, func
import secrets


class User(db.Model, UserMixin):
    __tablename__ = 'users'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(40), nullable=False)
    last_name = db.Column(db.String(40), nullable=False)
    username = db.Column(db.String(40), nullable=False, unique=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    profile_image = db.Column(db.String(255))
    bio = db.Column(db.Text)
    cover_image_url = db.Column(db.String(255))
    twitter_handle = db.Column(db.String(100))
    github_handle = db.Column(db.String(100))
    website_url = db.Column(db.String(255))
    digest_frequency = db.Column(db.String(10), default='none', nullable=False, server_default='none')
    unsubscribe_token = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    hashed_password = db.Column(db.String(255), nullable=False)

    following = db.relationship('Follower', back_populates='follower_user', foreign_keys='Follower.follower_id')
    followers = db.relationship('Follower', back_populates='author_user', foreign_keys='Follower.author_id')
    comments = db.relationship('Comment', back_populates='user', cascade='all, delete-orphan')
    story_claps = db.relationship('Clap', back_populates='user', cascade='all, delete-orphan')
    comment_claps = db.relationship('CommentClap', back_populates='user', cascade='all, delete-orphan')
    bookmarks = db.relationship('Bookmark', back_populates='user', cascade='all, delete-orphan')
    highlights = db.relationship('StoryHighlight', back_populates='user', cascade='all, delete-orphan')

    @property
    def password(self):
        return self.hashed_password

    @password.setter
    def password(self, password):
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

    def generate_unsubscribe_token(self):
        if not self.unsubscribe_token:
            self.unsubscribe_token = secrets.token_urlsafe(32)

    def to_dict(self):
        return {
            'id': self.id,
            'firstName': self.first_name,
            'lastName': self.last_name,
            'username': self.username,
            'email': self.email,
            'profileImage': self.profile_image,
            'bio': self.bio,
            'coverImageUrl': self.cover_image_url,
            'twitterHandle': self.twitter_handle,
            'githubHandle': self.github_handle,
            'websiteUrl': self.website_url,
            'digestFrequency': self.digest_frequency,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at,
            'followers': [follower.to_dict() for follower in self.followers],
            'followings': [follow.to_dict() for follow in self.following],
            'numFollowers': len(self.followers),
            'numFollowing': len(self.following),
        }
