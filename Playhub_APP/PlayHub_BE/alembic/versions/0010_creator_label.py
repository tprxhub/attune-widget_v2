"""Editable "Created by" credit on Play Plans and Play Doses.

Revision ID: 0010_creator_label
Revises: 0009_play_dose_creator
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_creator_label"
down_revision = "0009_play_dose_creator"
branch_labels = None
depends_on = None

TABLES = ("play_plans", "play_doses")


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if "created_by_label" not in {column["name"] for column in inspector.get_columns(table)}:
            op.add_column(table, sa.Column("created_by_label", sa.String(120), nullable=True))


def downgrade() -> None:
    for table in TABLES:
        with op.batch_alter_table(table) as batch:
            batch.drop_column("created_by_label")
