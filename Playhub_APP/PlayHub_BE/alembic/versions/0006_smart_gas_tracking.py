"""Add SMART goals, daily support checks and GAS tracking.

Revision ID: 0006_smart_gas_tracking
Revises: 0005_user_avatars
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_smart_gas_tracking"
down_revision = "0005_user_avatars"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    dose_columns = {column["name"] for column in inspector.get_columns("play_doses")}
    dose_additions = {
        "smart_goal": sa.Column("smart_goal", sa.Text(), nullable=True),
        "real_life_try_title": sa.Column("real_life_try_title", sa.String(200), nullable=True),
        "real_life_try_instructions": sa.Column("real_life_try_instructions", sa.JSON(), nullable=False, server_default="[]"),
        "real_life_try_items": sa.Column("real_life_try_items", sa.JSON(), nullable=False, server_default="[]"),
        "builds_on": sa.Column("builds_on", sa.JSON(), nullable=False, server_default="[]"),
        "passed_if": sa.Column("passed_if", sa.Text(), nullable=True),
        "gas_score": sa.Column("gas_score", sa.Integer(), nullable=True),
        "safety_note": sa.Column("safety_note", sa.Text(), nullable=True),
    }
    for name, column in dose_additions.items():
        if name not in dose_columns:
            op.add_column("play_doses", column)

    activity_columns = {column["name"] for column in inspector.get_columns("activities")}
    if "is_real_life_try" not in activity_columns:
        op.add_column("activities", sa.Column("is_real_life_try", sa.Boolean(), nullable=False, server_default=sa.false()))

    attempt_columns = {column["name"] for column in inspector.get_columns("attempts")}
    attempt_additions = {
        "completion_status": sa.Column("completion_status", sa.String(32), nullable=False, server_default="PARTLY"),
        "help_level": sa.Column("help_level", sa.String(32), nullable=False, server_default="FEW_REMINDERS"),
        "is_real_life_try": sa.Column("is_real_life_try", sa.Boolean(), nullable=False, server_default=sa.false()),
        "week_number": sa.Column("week_number", sa.Integer(), nullable=False, server_default="1"),
        "run_number": sa.Column("run_number", sa.Integer(), nullable=False, server_default="1"),
    }
    for name, column in attempt_additions.items():
        if name not in attempt_columns:
            op.add_column("attempts", column)

    def typed(column: str, expression: str) -> str:
        # PostgreSQL will not assign text to an enum column without a cast.
        bind = op.get_bind()
        if bind.dialect.name != "postgresql":
            return expression
        udt_name = bind.execute(
            sa.text(
                "SELECT udt_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = 'attempts' AND column_name = :column"
            ),
            {"column": column},
        ).scalar()
        return expression if udt_name in (None, "varchar", "text") else f"CAST({expression} AS {udt_name})"

    completion_status = (
        "CASE WHEN completion_score >= 4 THEN 'FINISHED' WHEN completion_score = 3 THEN 'PARTLY' "
        "ELSE 'STOPPED_EARLY' END"
    )
    help_level = (
        "CASE WHEN completion_score = 5 THEN 'INDEPENDENT' WHEN completion_score = 4 THEN 'ONE_REMINDER' "
        "WHEN completion_score = 3 THEN 'FEW_REMINDERS' ELSE 'HANDS_ON' END"
    )
    op.execute(f"UPDATE attempts SET completion_status = {typed('completion_status', completion_status)}")
    op.execute(f"UPDATE attempts SET help_level = {typed('help_level', help_level)}")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    attempt_columns = {column["name"] for column in inspector.get_columns("attempts")}
    for column in ("run_number", "week_number", "is_real_life_try", "help_level", "completion_status"):
        if column in attempt_columns:
            op.drop_column("attempts", column)
    if "is_real_life_try" in {column["name"] for column in inspector.get_columns("activities")}:
        op.drop_column("activities", "is_real_life_try")
    dose_columns = {column["name"] for column in inspector.get_columns("play_doses")}
    for column in (
        "safety_note", "gas_score", "passed_if", "builds_on", "real_life_try_items",
        "real_life_try_instructions", "real_life_try_title", "smart_goal",
    ):
        if column in dose_columns:
            op.drop_column("play_doses", column)
