"""Record who created each Play Plan.

Revision ID: 0008_play_plan_creator
Revises: 0007_site_content
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_play_plan_creator"
down_revision = "0007_site_content"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("play_plans")}
    if "created_by_id" in columns:
        return
    with op.batch_alter_table("play_plans") as batch:
        batch.add_column(sa.Column("created_by_id", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_play_plans_created_by", "users", ["created_by_id"], ["id"], ondelete="SET NULL")
        batch.create_index("ix_play_plans_created_by_id", ["created_by_id"])


def downgrade() -> None:
    with op.batch_alter_table("play_plans") as batch:
        batch.drop_index("ix_play_plans_created_by_id")
        batch.drop_constraint("fk_play_plans_created_by", type_="foreignkey")
        batch.drop_column("created_by_id")
