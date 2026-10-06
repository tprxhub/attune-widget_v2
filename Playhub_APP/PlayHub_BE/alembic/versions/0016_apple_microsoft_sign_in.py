"""Link accounts to Sign in with Apple and Sign in with Microsoft.

Revision ID: 0016_apple_microsoft_sign_in
Revises: 0015_subscription_renewal
"""
from alembic import op
import sqlalchemy as sa

revision = "0016_apple_microsoft_sign_in"
down_revision = "0015_subscription_renewal"
branch_labels = None
depends_on = None

COLUMNS = ("apple_subject", "microsoft_subject")


def upgrade() -> None:
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("users")}
    for name in COLUMNS:
        if name not in existing:
            op.add_column("users", sa.Column(name, sa.String(length=255), nullable=True))
            op.create_index(f"ix_users_{name}", "users", [name], unique=True)


def downgrade() -> None:
    for name in COLUMNS:
        op.drop_index(f"ix_users_{name}", table_name="users")
        with op.batch_alter_table("users") as batch:
            batch.drop_column(name)
