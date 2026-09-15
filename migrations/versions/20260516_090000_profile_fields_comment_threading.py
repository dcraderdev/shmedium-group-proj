"""Add profile fields to users and parent_id to comments

Revision ID: f1a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2026-05-16 09:00:00

NOTE: this revision was originally authored as 'e5f6a1b2c3d4', which collided
with 20260516_120000_add_story_is_published.py. Alembic silently dropped one of
the two from the revision graph, so these columns never got created. Renamed to
a unique id. The upgrade body is idempotent (IF NOT EXISTS), so it is safe to
run against a database that was partially migrated by hand.
"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

revision = 'f1a2b3c4d5e6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    schema = SCHEMA if environment == "production" else None
    prefix = f"{SCHEMA}." if schema else ""

    # Use IF NOT EXISTS so this is safe to re-run if columns were added manually
    for col, col_type in [
        ('bio', 'TEXT'),
        ('cover_image_url', 'VARCHAR(255)'),
        ('twitter_handle', 'VARCHAR(100)'),
        ('github_handle', 'VARCHAR(100)'),
        ('website_url', 'VARCHAR(255)'),
    ]:
        op.execute(f"ALTER TABLE {prefix}users ADD COLUMN IF NOT EXISTS {col} {col_type}")

    op.execute(f"ALTER TABLE {prefix}comments ADD COLUMN IF NOT EXISTS parent_id INTEGER")
    op.execute(
        f"ALTER TABLE {prefix}comments DROP CONSTRAINT IF EXISTS fk_comments_parent_id"
    )
    op.execute(
        f"ALTER TABLE {prefix}comments ADD CONSTRAINT fk_comments_parent_id "
        f"FOREIGN KEY (parent_id) REFERENCES {prefix}comments(id) ON DELETE CASCADE"
    )
    op.execute(
        f"CREATE INDEX IF NOT EXISTS ix_comments_parent_id ON {prefix}comments (parent_id)"
    )


def downgrade():
    schema = SCHEMA if environment == "production" else None
    prefix = f"{SCHEMA}." if schema else ""

    op.execute(f"DROP INDEX IF EXISTS ix_comments_parent_id")
    op.execute(f"ALTER TABLE {prefix}comments DROP CONSTRAINT IF EXISTS fk_comments_parent_id")
    op.execute(f"ALTER TABLE {prefix}comments DROP COLUMN IF EXISTS parent_id")

    for col in ['website_url', 'github_handle', 'twitter_handle', 'cover_image_url', 'bio']:
        op.execute(f"ALTER TABLE {prefix}users DROP COLUMN IF EXISTS {col}")
