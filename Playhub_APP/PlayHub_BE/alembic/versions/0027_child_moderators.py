"""A member can have several Moderators: copy children.moderator_id into a child_moderators table.

The old column stays for now (the app no longer reads it), so the version still serving during a
deploy keeps working, and rolling back is safe. A later migration can drop it.

Revision ID: 0027_child_moderators
Revises: 0026_attune_blueprint
"""
from alembic import op
import sqlalchemy as sa

revision = "0027_child_moderators"
down_revision = "0026_attune_blueprint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "child_moderators" not in inspector.get_table_names():
        op.create_table(
            "child_moderators",
            sa.Column("child_id", sa.String(36), sa.ForeignKey("children.id", ondelete="CASCADE"), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        )
        op.create_index("ix_child_moderators_user_id", "child_moderators", ["user_id"])
    columns = {column["name"] for column in inspector.get_columns("children")}
    if "moderator_id" in columns:
        # Every current assignment becomes the member's first Moderator.
        op.execute(
            "INSERT INTO child_moderators (child_id, user_id) "
            "SELECT c.id, c.moderator_id FROM children c "
            "WHERE c.moderator_id IS NOT NULL AND NOT EXISTS ("
            "SELECT 1 FROM child_moderators cm WHERE cm.child_id = c.id AND cm.user_id = c.moderator_id)"
        )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("children")}
    if "moderator_id" not in columns:
        with op.batch_alter_table("children") as batch:
            batch.add_column(sa.Column("moderator_id", sa.String(36), nullable=True))
            batch.create_foreign_key("fk_children_moderator_id_users", "users", ["moderator_id"], ["id"], ondelete="SET NULL")
        op.create_index("ix_children_moderator_id", "children", ["moderator_id"])
    # One Moderator per member again: the first by id.
    op.execute(
        "UPDATE children SET moderator_id = ("
        "SELECT MIN(cm.user_id) FROM child_moderators cm WHERE cm.child_id = children.id)"
    )
    op.drop_index("ix_child_moderators_user_id", table_name="child_moderators")
    op.drop_table("child_moderators")
