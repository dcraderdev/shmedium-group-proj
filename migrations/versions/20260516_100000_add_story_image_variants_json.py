"""Add variants_json column to story_images

Stores pre-computed variant URLs as JSON so the backfill can populate
responsive image sets for external-URL images without needing S3 access.
For S3-hosted images the column is left NULL and presigned URLs are
generated at request time from file_name instead.

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-05-16 10:00:00
"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

revision = 'd4e5f6a1b2c3'
down_revision = 'c3d4e5f6a1b2'
branch_labels = None
depends_on = None


def upgrade():
    schema = SCHEMA if environment == "production" else None
    with op.batch_alter_table('story_images', schema=schema) as batch_op:
        batch_op.add_column(
            sa.Column('variants_json', sa.Text(), nullable=True)
        )


def downgrade():
    schema = SCHEMA if environment == "production" else None
    with op.batch_alter_table('story_images', schema=schema) as batch_op:
        batch_op.drop_column('variants_json')
