"""Remember when a Session was last edited, and by whom.

Revision ID: 0021_attempt_edited
Revises: 0020_subscription_notices
"""
from alembic import op
import sqlalchemy as sa

revision = "0021_attempt_edited"
down_revision = "0020_subscription_notices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("attempts")}
    with op.batch_alter_table("attempts") as batch:
        if "edited_at" not in existing:
            batch.add_column(sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))
        if "edited_by_id" not in existing:
            batch.add_column(sa.Column("edited_by_id", sa.String(36), nullable=True))
            batch.create_foreign_key("fk_attempts_edited_by_id_users", "users", ["edited_by_id"], ["id"], ondelete="SET NULL")
    # Sessions corrected before this column existed: take the latest correction from the audit trail.
    op.execute(
        """
        UPDATE attempts SET
            edited_at = (SELECT MAX(e.created_at) FROM audit_events e
                         WHERE e.action = 'attempt.corrected' AND e.resource_id = attempts.id),
            edited_by_id = (SELECT e.actor_id FROM audit_events e
                            WHERE e.action = 'attempt.corrected' AND e.resource_id = attempts.id
                            ORDER BY e.created_at DESC LIMIT 1)
        WHERE edited_at IS NULL AND EXISTS (
            SELECT 1 FROM audit_events e WHERE e.action = 'attempt.corrected' AND e.resource_id = attempts.id)
        """
    )


def downgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("attempts")}
    with op.batch_alter_table("attempts") as batch:
        if "edited_by_id" in existing:
            batch.drop_column("edited_by_id")
        if "edited_at" in existing:
            batch.drop_column("edited_at")
