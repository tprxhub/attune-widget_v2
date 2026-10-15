"""Organisation licence type: count children or Moderators against the licence limit.

Revision ID: 0024_org_license_type
Revises: 0023_play_pulse
"""
from alembic import op
import sqlalchemy as sa

revision = "0024_org_license_type"
down_revision = "0023_play_pulse"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("organisations")}
    if "license_type" not in columns:
        with op.batch_alter_table("organisations") as batch:
            batch.add_column(sa.Column("license_type", sa.String(16), nullable=False, server_default="children"))


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("organisations")}
    if "license_type" in columns:
        with op.batch_alter_table("organisations") as batch:
            batch.drop_column("license_type")
