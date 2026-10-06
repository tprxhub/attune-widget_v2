"""Help level is only asked when the child finished, so it can be empty.

Revision ID: 0013_attempt_help_optional
Revises: 0012_play_plan_order
"""
from alembic import op
import sqlalchemy as sa

revision = "0013_attempt_help_optional"
down_revision = "0012_play_plan_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("attempts") as batch:
        batch.alter_column("help_level", existing_type=sa.String(32), nullable=True)
    # "Partly" is no longer an answer: a session either finished or it did not, so earlier partly
    # sessions count as not finished and carry no help level.
    op.execute("UPDATE attempts SET help_level = NULL WHERE completion_status IN ('PARTLY', 'STOPPED_EARLY')")
    op.execute("UPDATE attempts SET completion_status = 'STOPPED_EARLY' WHERE completion_status = 'PARTLY'")


def downgrade() -> None:
    op.execute("UPDATE attempts SET help_level = 'HANDS_ON' WHERE help_level IS NULL")
    with op.batch_alter_table("attempts") as batch:
        batch.alter_column("help_level", existing_type=sa.String(32), nullable=False)
