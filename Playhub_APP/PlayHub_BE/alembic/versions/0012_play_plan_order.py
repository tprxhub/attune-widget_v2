"""Let admins order Play Plans (and Play Doses) instead of sorting by name.

Revision ID: 0012_play_plan_order
Revises: 0011_ttp_employees
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_play_plan_order"
down_revision = "0011_ttp_employees"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "sort_order" not in {column["name"] for column in inspector.get_columns("play_plans")}:
        op.add_column("play_plans", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))

    # Keep today's order: plans alphabetically, doses by their current position.
    for index, (plan_id,) in enumerate(bind.execute(sa.text("SELECT id FROM play_plans ORDER BY name")).all()):
        bind.execute(sa.text("UPDATE play_plans SET sort_order = :n WHERE id = :id"), {"n": index, "id": plan_id})
        doses = bind.execute(
            sa.text("SELECT id FROM play_doses WHERE play_plan_id = :id ORDER BY sort_order, created_at"), {"id": plan_id}
        ).all()
        for position, (dose_id,) in enumerate(doses):
            bind.execute(sa.text("UPDATE play_doses SET sort_order = :n WHERE id = :id"), {"n": position, "id": dose_id})


def downgrade() -> None:
    with op.batch_alter_table("play_plans") as batch:
        batch.drop_column("sort_order")
