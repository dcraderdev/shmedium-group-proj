from .db import db, environment, SCHEMA, add_prefix_for_prod
from datetime import datetime
from ..aws3 import s3, bucket

_VARIANT_SIZES = [
    ('thumbnail', '400w', 400),
    ('card',      '800w', 800),
    ('full',      '1600w', 1600),
]


class StoryImage(db.Model):
    __tablename__ = 'story_images'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('stories.id')), nullable=False)
    url = db.Column(db.String(255), nullable=False)
    file_name = db.Column(db.String(255), nullable=True, default=None)
    has_variants = db.Column(db.Boolean, nullable=True, default=False)
    position = db.Column(db.Integer, nullable=False)
    alt_tag = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    story = db.relationship('Story', back_populates='images')

    def _presigned(self, key):
        return s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=3600,
        )

    def to_dict(self):
        if self.file_name:
            final_url = self._presigned(self.file_name)
        else:
            final_url = self.url

        result = {
            'id': self.id,
            'storyId': self.story_id,
            'url': final_url,
            'fileName': self.file_name,
            'position': self.position,
            'altTag': self.alt_tag,
            'variants': None,
        }

        if self.has_variants and self.file_name:
            stem = self.file_name.rsplit('.', 1)[0]
            result['variants'] = {
                name: {
                    'jpeg': self._presigned(f"{stem}_{suffix}.jpg"),
                    'webp': self._presigned(f"{stem}_{suffix}.webp"),
                    'width': width,
                }
                for name, suffix, width in _VARIANT_SIZES
            }

        return result
