"""Add Google identity and Stripe payment references.

Revision ID: 0003_google_auth_stripe_billing
Revises: 0002_accounts_invites_audit
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_google_auth_stripe_billing"
down_revision = "0002_accounts_invites_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "google_subject" not in user_columns:
        op.add_column("users", sa.Column("google_subject", sa.String(255), nullable=True))
    user_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("users")}
    if "ix_users_google_subject" not in user_indexes:
        op.create_index("ix_users_google_subject", "users", ["google_subject"], unique=True)

    subscription_columns = {column["name"] for column in inspector.get_columns("subscriptions")}
    for name in (
        "stripe_checkout_session_id",
        "stripe_payment_intent_id",
        "stripe_customer_id",
        "stripe_refund_id",
    ):
        if name not in subscription_columns:
            op.add_column("subscriptions", sa.Column(name, sa.String(255), nullable=True))
    subscription_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("subscriptions")}
    for name, unique in (
        ("stripe_checkout_session_id", True),
        ("stripe_payment_intent_id", True),
        ("stripe_customer_id", False),
    ):
        index_name = f"ix_subscriptions_{name}"
        if index_name not in subscription_indexes:
            op.create_index(index_name, "subscriptions", [name], unique=unique)


def downgrade() -> None:
    op.drop_index("ix_subscriptions_stripe_customer_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_stripe_payment_intent_id", table_name="subscriptions")
    op.drop_index("ix_subscriptions_stripe_checkout_session_id", table_name="subscriptions")
    op.drop_column("subscriptions", "stripe_refund_id")
    op.drop_column("subscriptions", "stripe_customer_id")
    op.drop_column("subscriptions", "stripe_payment_intent_id")
    op.drop_column("subscriptions", "stripe_checkout_session_id")
    op.drop_index("ix_users_google_subject", table_name="users")
    op.drop_column("users", "google_subject")
