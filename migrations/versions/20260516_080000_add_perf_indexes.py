"""Add indexes on hot foreign-key columns

Postgres does not auto-index foreign keys. Selectinload and explicit FK filters
hit these columns on every story-list and feed query — adding btree indexes
makes them O(log N) instead of seq scans.

Revision ID: a1b2c3d4e5f6
Revises: 069820b9dd42
Create Date: 2026-05-16 08:00:00
"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")


revision = 'a1b2c3d4e5f6'
down_revision = '069820b9dd42'
branch_labels = None
depends_on = None


# Indexes to add. (index_name, table_name, column_name)
INDEXES = [
    ('ix_stories_author_id', 'stories', 'author_id'),
    ('ix_stories_created_at', 'stories', 'created_at'),
    ('ix_claps_story_id', 'claps', 'story_id'),
    ('ix_claps_user_id', 'claps', 'user_id'),
    ('ix_comments_story_id', 'comments', 'story_id'),
    ('ix_comments_user_id', 'comments', 'user_id'),
    ('ix_comment_claps_comment_id', 'comment_claps', 'comment_id'),
    ('ix_story_tags_story_id', 'story_tags', 'story_id'),
    ('ix_story_tags_tag_id', 'story_tags', 'tag_id'),
    ('ix_story_images_story_id', 'story_images', 'story_id'),
    ('ix_followers_follower_id', 'followers', 'follower_id'),
    ('ix_followers_author_id', 'followers', 'author_id'),
]


def upgrade():
    schema = SCHEMA if environment == "production" else None
    for index_name, table_name, column_name in INDEXES:
        op.create_index(
            index_name,
            table_name,
            [column_name],
            schema=schema,
            if_not_exists=True,
        )


def downgrade():
    schema = SCHEMA if environment == "production" else None
    for index_name, table_name, _ in INDEXES:
        op.drop_index(index_name, table_name=table_name, schema=schema, if_exists=True)
