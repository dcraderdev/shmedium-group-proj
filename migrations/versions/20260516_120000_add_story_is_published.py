"""add is_published to stories

Revision ID: e5f6a1b2c3d4
Revises: d4e5f6a1b2c3
Create Date: 2026-05-16 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import os

revision = 'e5f6a1b2c3d4'
down_revision = 'd4e5f6a1b2c3'

environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")


def upgrade():
    with op.batch_alter_table('stories', schema=SCHEMA if environment == "production" else None) as batch_op:
        batch_op.add_column(sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.text('true')))


def downgrade():
    with op.batch_alter_table('stories', schema=SCHEMA if environment == "production" else None) as batch_op:
        batch_op.drop_column('is_published')
