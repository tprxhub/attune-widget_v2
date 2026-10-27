"""Super Admins can switch on email notifications (account emails and platform alerts).

Adding a column with a default is safe while the previous version is still serving.

Revision ID: 0031_super_admin_notifications
Revises: 0030_restore_plain_steps
"""
from alembic import op
import sqlalchemy as sa

revision = "0031_super_admin_notifications"
down_revision = "0030_restore_plain_steps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    if "email_notifications" not in columns:
        op.add_column(
            "users",
            sa.Column("email_notifications", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    op.drop_column("users", "email_notifications")
