"""Add invitation and audit history support.

Revision ID: 0002_accounts_invites_audit
Revises: 0001_initial_schema
"""
from alembic import op
from app.models import AuditEvent, Invitation

revision = "0002_accounts_invites_audit"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Invitation.__table__.create(bind=bind, checkfirst=True)
    AuditEvent.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    AuditEvent.__table__.drop(bind=bind, checkfirst=True)
    Invitation.__table__.drop(bind=bind, checkfirst=True)
