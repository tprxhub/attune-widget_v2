"""Organisation billing schedule: Billing 1, Billing 2, ... one after another.

A new table only, so the previous version keeps serving while this runs.

Revision ID: 0032_organisation_billing
Revises: 0031_super_admin_notifications
"""
from alembic import op
import sqlalchemy as sa

revision = "0032_organisation_billing"
down_revision = "0031_super_admin_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "organisation_billings" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "organisation_billings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organisation_id", sa.String(36), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("months", sa.Integer(), nullable=False),
        sa.Column("licenses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("license_price", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("note", sa.String(500)),
        sa.Column("added_by_id", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("added_by_name", sa.String(120)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("organisation_id", "sequence", name="uq_organisation_billing_sequence"),
    )
    op.create_index("ix_organisation_billings_organisation_id", "organisation_billings", ["organisation_id"])


def downgrade() -> None:
    op.drop_index("ix_organisation_billings_organisation_id", table_name="organisation_billings")
    op.drop_table("organisation_billings")
