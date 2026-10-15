"""Organisation billing: price per licence, billing start and renewal dates.

Revision ID: 0025_org_billing
Revises: 0024_org_license_type
"""
from alembic import op
import sqlalchemy as sa

revision = "0025_org_billing"
down_revision = "0024_org_license_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("organisations")}
    with op.batch_alter_table("organisations") as batch:
        if "license_price" not in columns:
            batch.add_column(sa.Column("license_price", sa.Integer(), nullable=False, server_default="0"))
        if "billing_started_on" not in columns:
            batch.add_column(sa.Column("billing_started_on", sa.Date(), nullable=True))
        if "renews_on" not in columns:
            batch.add_column(sa.Column("renews_on", sa.Date(), nullable=True))
    # The cycle was a free-text label; keep only the two values the app now understands.
    op.execute(
        "UPDATE organisations SET billing_cycle = 'annual' "
        "WHERE billing_cycle IS NULL OR lower(billing_cycle) NOT IN ('monthly', 'annual')"
    )
    op.execute("UPDATE organisations SET billing_cycle = lower(billing_cycle)")


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("organisations")}
    with op.batch_alter_table("organisations") as batch:
        for name in ("renews_on", "billing_started_on", "license_price"):
            if name in columns:
                batch.drop_column(name)
