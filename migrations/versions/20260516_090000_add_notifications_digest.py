"""Add notifications table and digest preferences to users

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-05-16 09:00:00
"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

revision = 'c3d4e5f6a7b8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    schema = SCHEMA if environment == "production" else None
    users_table = f"{SCHEMA}.users" if schema else "users"

    op.add_column('users',
        sa.Column('digest_frequency', sa.String(10), nullable=False, server_default='none'),
        schema=schema,
    )
    op.add_column('users',
        sa.Column('unsubscribe_token', sa.String(64), nullable=True),
        schema=schema,
    )

    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey(f"{users_table}.id"), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('actor_id', sa.Integer, sa.ForeignKey(f"{users_table}.id"), nullable=False),
        sa.Column('target_type', sa.String(20), nullable=True),
        sa.Column('target_id', sa.Integer, nullable=True),
        sa.Column('read', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        schema=schema,
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'], schema=schema)
    op.create_index('ix_notifications_read', 'notifications', ['read'], schema=schema)
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'], schema=schema)


def downgrade():
    schema = SCHEMA if environment == "production" else None
    op.drop_index('ix_notifications_created_at', table_name='notifications', schema=schema)
    op.drop_index('ix_notifications_read', table_name='notifications', schema=schema)
    op.drop_index('ix_notifications_user_id', table_name='notifications', schema=schema)
    op.drop_table('notifications', schema=schema)
    op.drop_column('users', 'unsubscribe_token', schema=schema)
    op.drop_column('users', 'digest_frequency', schema=schema)
