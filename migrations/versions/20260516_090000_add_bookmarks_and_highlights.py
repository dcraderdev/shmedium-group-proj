"""Add bookmarks and story_highlights tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-16 09:00:00
"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    schema = SCHEMA if environment == "production" else None
    schema_prefix = f"{SCHEMA}." if schema else ""

    op.create_table(
        'bookmarks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('story_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], [f'{schema_prefix}users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['story_id'], [f'{schema_prefix}stories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema=schema,
    )
    op.create_index('ix_bookmarks_user_id', 'bookmarks', ['user_id'], schema=schema)
    op.create_index('ix_bookmarks_story_id', 'bookmarks', ['story_id'], schema=schema)
    op.create_index(
        'uq_bookmarks_user_story', 'bookmarks', ['user_id', 'story_id'],
        unique=True, schema=schema
    )

    op.create_table(
        'story_highlights',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('story_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.String(1000), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], [f'{schema_prefix}users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['story_id'], [f'{schema_prefix}stories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema=schema,
    )
    op.create_index('ix_story_highlights_story_id', 'story_highlights', ['story_id'], schema=schema)
    op.create_index('ix_story_highlights_user_id', 'story_highlights', ['user_id'], schema=schema)


def downgrade():
    schema = SCHEMA if environment == "production" else None
    op.drop_table('story_highlights', schema=schema)
    op.drop_table('bookmarks', schema=schema)
