"""Remember the last day before a renewal, so refunding the renewal keeps the days already paid for.

Revision ID: 0015_subscription_renewal
Revises: 0014_password_reset_tokens
"""
from alembic import op
import sqlalchemy as sa

revision = "0015_subscription_renewal"
down_revision = "0014_password_reset_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "previous_ends_on" not in {column["name"] for column in inspector.get_columns("subscriptions")}:
        op.add_column("subscriptions", sa.Column("previous_ends_on", sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("subscriptions") as batch:
        batch.drop_column("previous_ends_on")
