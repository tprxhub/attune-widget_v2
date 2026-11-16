"""Signup email verification codes, and plans paid for during signup.

Two new tables; nothing existing changes, so the previous version keeps serving while this runs.

Revision ID: 0036_signup_email_codes
Revises: 0035_play_pulse_responses
"""
from alembic import op
import sqlalchemy as sa

revision = "0036_signup_email_codes"
down_revision = "0035_play_pulse_responses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("signup_payments"):
        op.create_table(
            "signup_payments",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("plan", sa.String(20), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("stripe_checkout_session_id", sa.String(255), nullable=False),
            sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True),
            sa.Column("stripe_customer_id", sa.String(255), nullable=True),
            sa.Column("amount_paid", sa.Integer(), nullable=True),
            sa.Column("months", sa.Integer(), nullable=True),
            sa.Column("plan_label", sa.String(200), nullable=True),
            sa.Column("paid_on", sa.Date(), nullable=True),
            sa.Column("claimed_child_id", sa.String(36), sa.ForeignKey("children.id", ondelete="SET NULL"), nullable=True),
            sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_signup_payments_email", "signup_payments", ["email"])
        op.create_index("ix_signup_payments_stripe_checkout_session_id", "signup_payments",
                        ["stripe_checkout_session_id"], unique=True)
    if inspector.has_table("signup_email_codes"):
        return
    op.create_table(
        "signup_email_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_signup_email_codes_email", "signup_email_codes", ["email"])


def downgrade() -> None:
    op.drop_index("ix_signup_payments_stripe_checkout_session_id", table_name="signup_payments")
    op.drop_index("ix_signup_payments_email", table_name="signup_payments")
    op.drop_table("signup_payments")
    op.drop_index("ix_signup_email_codes_email", table_name="signup_email_codes")
    op.drop_table("signup_email_codes")
