"""TTP employee role with per-page permissions.

Revision ID: 0011_ttp_employees
Revises: 0010_creator_label
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_ttp_employees"
down_revision = "0010_creator_label"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # A new enum label cannot be used in the same transaction that adds it.
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'TTP_EMPLOYEE'")
    inspector = sa.inspect(bind)
    for table in ("users", "invitations"):
        if "permissions" not in {column["name"] for column in inspector.get_columns(table)}:
            op.add_column(table, sa.Column("permissions", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    for table in ("users", "invitations"):
        with op.batch_alter_table(table) as batch:
            batch.drop_column("permissions")
