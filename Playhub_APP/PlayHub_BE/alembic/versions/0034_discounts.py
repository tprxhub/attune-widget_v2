"""Subscription discounts (coupons) and their redemptions, and the amount each subscription paid.

New tables and one new nullable column only, so the previous version keeps serving while this runs.

Revision ID: 0034_discounts
Revises: 0033_play_categories
"""
from alembic import op
import sqlalchemy as sa

revision = "0034_discounts"
down_revision = "0033_play_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tables = sa.inspect(op.get_bind()).get_table_names()
    if "discounts" not in tables:
        op.create_table(
            "discounts",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("code", sa.String(40), nullable=False),
            sa.Column("title", sa.String(80), nullable=False),
            sa.Column("description", sa.String(300)),
            sa.Column("kind", sa.String(10), nullable=False),
            sa.Column("value", sa.Integer(), nullable=False),
            sa.Column("max_discount", sa.Integer()),
            sa.Column("plans", sa.JSON(), nullable=False),
            sa.Column("starts_on", sa.Date()),
            sa.Column("ends_on", sa.Date()),
            sa.Column("max_uses", sa.Integer()),
            sa.Column("once_per_account", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("new_customers_only", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("show_in_offers", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_discounts_code", "discounts", ["code"], unique=True)
    if "discount_redemptions" not in tables:
        op.create_table(
            "discount_redemptions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("discount_id", sa.String(36), sa.ForeignKey("discounts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("child_id", sa.String(36), sa.ForeignKey("children.id", ondelete="SET NULL")),
            sa.Column("plan", sa.String(8), nullable=False),
            sa.Column("list_amount", sa.Integer(), nullable=False),
            sa.Column("discount_amount", sa.Integer(), nullable=False),
            sa.Column("stripe_checkout_session_id", sa.String(255), nullable=False, unique=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_discount_redemptions_discount_id", "discount_redemptions", ["discount_id"])
        op.create_index("ix_discount_redemptions_user_id", "discount_redemptions", ["user_id"])
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("subscriptions")}
    if "amount_paid" not in columns:
        op.add_column("subscriptions", sa.Column("amount_paid", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("subscriptions", "amount_paid")
    op.drop_table("discount_redemptions")
    op.drop_table("discounts")
