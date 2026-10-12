"""Attune AI assistant conversations and messages.

Revision ID: 0022_attune
Revises: 0021_attempt_edited
"""
from alembic import op
import sqlalchemy as sa

revision = "0022_attune"
down_revision = "0021_attempt_edited"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "attune_conversations" not in tables:
        op.create_table(
            "attune_conversations",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("child_id", sa.String(36), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=True),
            sa.Column("title", sa.String(160), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_attune_conversations_user_id", "attune_conversations", ["user_id"])
        op.create_index("ix_attune_conversations_child_id", "attune_conversations", ["child_id"])
    if "attune_messages" not in tables:
        op.create_table(
            "attune_messages",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "conversation_id", sa.String(36),
                sa.ForeignKey("attune_conversations.id", ondelete="CASCADE"), nullable=False,
            ),
            sa.Column("role", sa.String(16), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("activity_id", sa.String(36), sa.ForeignKey("activities.id", ondelete="SET NULL"), nullable=True),
            sa.Column("feedback", sa.String(8), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_attune_messages_conversation_id", "attune_messages", ["conversation_id"])
    elif "feedback" not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("attune_messages")}:
        # Databases that ran an earlier draft of this revision.
        with op.batch_alter_table("attune_messages") as batch:
            batch.add_column(sa.Column("feedback", sa.String(8), nullable=True))


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "attune_messages" in tables:
        op.drop_table("attune_messages")
    if "attune_conversations" in tables:
        op.drop_table("attune_conversations")
