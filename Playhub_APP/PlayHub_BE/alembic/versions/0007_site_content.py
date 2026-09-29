"""Add editable site content for the public home page.

Revision ID: 0007_site_content
Revises: 0006_smart_gas_tracking
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_site_content"
down_revision = "0006_smart_gas_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "site_content" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "site_content",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("updated_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if "site_content" in sa.inspect(bind).get_table_names():
        op.drop_table("site_content")
