"""Add Stripe webhook idempotency records.

Revision ID: 0004_stripe_webhook_events
Revises: 0003_google_auth_stripe_billing
"""
from alembic import op
from app.models import StripeEvent

revision = "0004_stripe_webhook_events"
down_revision = "0003_google_auth_stripe_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    StripeEvent.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    StripeEvent.__table__.drop(bind=op.get_bind(), checkfirst=True)
