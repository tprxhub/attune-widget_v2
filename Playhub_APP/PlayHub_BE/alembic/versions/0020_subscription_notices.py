"""Remember which subscription end date each reminder email was sent for.

Revision ID: 0020_subscription_notices
Revises: 0019_child_free_play_plan
"""
from alembic import op
import sqlalchemy as sa

revision = "0020_subscription_notices"
down_revision = "0019_child_free_play_plan"
branch_labels = None
depends_on = None

COLUMNS = ("renewal_reminder_for", "ended_notice_for")


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("subscriptions")}
    with op.batch_alter_table("subscriptions") as batch:
        for name in COLUMNS:
            if name not in existing:
                batch.add_column(sa.Column(name, sa.Date(), nullable=True))


def downgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("subscriptions")}
    with op.batch_alter_table("subscriptions") as batch:
        for name in COLUMNS:
            if name in existing:
                batch.drop_column(name)
