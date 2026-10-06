"""One-time password reset links.

Revision ID: 0014_password_reset_tokens
Revises: 0013_attempt_help_optional
"""
from alembic import op
import sqlalchemy as sa

revision = "0014_password_reset_tokens"
down_revision = "0013_attempt_help_optional"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "password_reset_tokens" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
