"""Self-service account deactivation: when an account was switched off, and by whom.

Two new columns with safe defaults, so the previous version keeps serving while this runs.
Accounts already switched off by an administrator stay that way (deactivated_by_self is false).

Revision ID: 0037_account_deactivation
Revises: 0036_signup_email_codes
"""
from alembic import op
import sqlalchemy as sa

revision = "0037_account_deactivation"
down_revision = "0036_signup_email_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "deactivated_at" not in columns:
        op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True))
    if "deactivated_by_self" not in columns:
        op.add_column("users", sa.Column("deactivated_by_self", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("users", "deactivated_by_self")
    op.drop_column("users", "deactivated_at")
