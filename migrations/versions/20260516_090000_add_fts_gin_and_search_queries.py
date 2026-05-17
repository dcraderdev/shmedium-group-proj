"""Add FTS GIN index on stories and search_queries tracking table

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-16 09:00:00
"""
from alembic import op
import sqlalchemy as sa
import os

environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    schema = SCHEMA if environment == "production" else None
    prefix = f"{SCHEMA}." if schema else ""

    op.create_table(
        'search_queries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('query', sa.String(255), nullable=False, unique=True),
        sa.Column('count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('last_searched_at', sa.DateTime(), nullable=False),
        schema=schema,
    )
    op.create_index('ix_search_queries_query', 'search_queries', ['query'], schema=schema)
    op.create_index('ix_search_queries_count', 'search_queries', ['count'], schema=schema)

    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        table = f"{prefix}stories"
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_stories_fts ON {table} USING gin("
            f"(setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
            f"setweight(to_tsvector('english', coalesce(content, '')), 'B')))"
        )


def downgrade():
    schema = SCHEMA if environment == "production" else None

    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP INDEX IF EXISTS ix_stories_fts")

    op.drop_index('ix_search_queries_count', table_name='search_queries', schema=schema)
    op.drop_index('ix_search_queries_query', table_name='search_queries', schema=schema)
    op.drop_table('search_queries', schema=schema)
