"""Formatted activity steps from the admin editor.

Revision ID: 0018_activity_rich_steps
Revises: 0017_plan_publication_status
"""
from alembic import op
import sqlalchemy as sa

revision = "0018_activity_rich_steps"
down_revision = "0017_plan_publication_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "instructions_html" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("activities")}:
        op.add_column("activities", sa.Column("instructions_html", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("activities") as batch:
        batch.drop_column("instructions_html")
