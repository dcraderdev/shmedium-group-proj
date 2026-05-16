"""Add profile fields to users and parent_id to comments

Revision ID: c3d4e5f6a1b2
Revises: a1b2c3d4e5f6
Create Date: 2026-05-16 09:00:00
"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

revision = 'c3d4e5f6a1b2'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    schema = SCHEMA if environment == "production" else None

    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True), schema=schema)
    op.add_column('users', sa.Column('cover_image_url', sa.String(length=255), nullable=True), schema=schema)
    op.add_column('users', sa.Column('twitter_handle', sa.String(length=100), nullable=True), schema=schema)
    op.add_column('users', sa.Column('github_handle', sa.String(length=100), nullable=True), schema=schema)
    op.add_column('users', sa.Column('website_url', sa.String(length=255), nullable=True), schema=schema)

    op.add_column('comments', sa.Column('parent_id', sa.Integer(), nullable=True), schema=schema)
    op.create_foreign_key(
        'fk_comments_parent_id',
        'comments', 'comments',
        ['parent_id'], ['id'],
        source_schema=schema,
        referent_schema=schema,
        ondelete='CASCADE',
    )
    op.create_index('ix_comments_parent_id', 'comments', ['parent_id'], schema=schema)


def downgrade():
    schema = SCHEMA if environment == "production" else None

    op.drop_index('ix_comments_parent_id', table_name='comments', schema=schema)
    op.drop_constraint('fk_comments_parent_id', 'comments', type_='foreignkey', schema=schema)
    op.drop_column('comments', 'parent_id', schema=schema)

    op.drop_column('users', 'website_url', schema=schema)
    op.drop_column('users', 'github_handle', schema=schema)
    op.drop_column('users', 'twitter_handle', schema=schema)
    op.drop_column('users', 'cover_image_url', schema=schema)
    op.drop_column('users', 'bio', schema=schema)
