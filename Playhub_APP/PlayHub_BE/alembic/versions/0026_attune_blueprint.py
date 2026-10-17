"""Attune blueprint: the kind of help asked for, sources, safety flag and handover summary.

Revision ID: 0026_attune_blueprint
Revises: 0025_org_billing
"""
from alembic import op
import sqlalchemy as sa

revision = "0026_attune_blueprint"
down_revision = "0025_org_billing"
branch_labels = None
depends_on = None

NEW_COLUMNS = ("mode", "sources", "safety", "summary")


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("attune_messages")}
    with op.batch_alter_table("attune_messages") as batch:
        if "mode" not in columns:
            batch.add_column(sa.Column("mode", sa.String(length=16), nullable=True))
        if "sources" not in columns:
            batch.add_column(sa.Column("sources", sa.JSON(), nullable=True))
        if "safety" not in columns:
            batch.add_column(sa.Column("safety", sa.Boolean(), nullable=False, server_default=sa.false()))
        if "summary" not in columns:
            batch.add_column(sa.Column("summary", sa.Text(), nullable=True))


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("attune_messages")}
    with op.batch_alter_table("attune_messages") as batch:
        for name in reversed(NEW_COLUMNS):
            if name in columns:
                batch.drop_column(name)
