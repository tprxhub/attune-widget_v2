"""The one Play Plan a free family child has chosen to open.

Revision ID: 0019_child_free_play_plan
Revises: 0018_activity_rich_steps
"""
from alembic import op
import sqlalchemy as sa

revision = "0019_child_free_play_plan"
down_revision = "0018_activity_rich_steps"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "free_play_plan_id" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("children")}:
        with op.batch_alter_table("children") as batch:
            batch.add_column(sa.Column("free_play_plan_id", sa.String(length=36), nullable=True))
            batch.create_foreign_key(
                "fk_children_free_play_plan_id", "play_plans", ["free_play_plan_id"], ["id"], ondelete="SET NULL"
            )


def downgrade() -> None:
    bind = op.get_bind()
    names = {fk["name"] for fk in sa.inspect(bind).get_foreign_keys("children") if fk["constrained_columns"] == ["free_play_plan_id"]}
    with op.batch_alter_table("children") as batch:
        for name in names:
            if name:
                batch.drop_constraint(name, type_="foreignkey")
        batch.drop_column("free_play_plan_id")
