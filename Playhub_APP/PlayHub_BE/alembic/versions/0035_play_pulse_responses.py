"""Play Pulse: keep each question and the answer chosen, in words.

One new nullable column, so the previous version keeps serving while this runs. Checks saved
before it have only their scores, in the existing `answers` column.

Revision ID: 0035_play_pulse_responses
Revises: 0034_discounts
"""
from alembic import op
import sqlalchemy as sa

revision = "0035_play_pulse_responses"
down_revision = "0034_discounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("play_pulse_results")}
    if "responses" not in columns:
        op.add_column("play_pulse_results", sa.Column("responses", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("play_pulse_results", "responses")
