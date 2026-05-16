from .db import db, environment, SCHEMA
from datetime import datetime


class SearchQuery(db.Model):
    __tablename__ = 'search_queries'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    query = db.Column(db.String(255), nullable=False, unique=True)
    count = db.Column(db.Integer, nullable=False, default=1)
    last_searched_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            'query': self.query,
            'count': self.count,
        }
