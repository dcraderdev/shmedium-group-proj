"""Add has_variants column to story_images

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
    with op.batch_alter_table('story_images', schema=schema) as batch_op:
        batch_op.add_column(
            sa.Column('has_variants', sa.Boolean(), nullable=True,
                      server_default=sa.false())
        )


def downgrade():
    schema = SCHEMA if environment == "production" else None
    with op.batch_alter_table('story_images', schema=schema) as batch_op:
        batch_op.drop_column('has_variants')
