"""Add user profile photos and stickers.

Revision ID: 0005_user_avatars
Revises: 0004_stripe_webhook_events
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_user_avatars"
down_revision = "0004_stripe_webhook_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
    if "avatar_url" not in columns:
        op.add_column("users", sa.Column("avatar_url", sa.String(1000), nullable=True))
    if "avatar_sticker" not in columns:
        op.add_column("users", sa.Column("avatar_sticker", sa.String(32), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("users")}
    if "avatar_sticker" in columns:
        op.drop_column("users", "avatar_sticker")
    if "avatar_url" in columns:
        op.drop_column("users", "avatar_url")
