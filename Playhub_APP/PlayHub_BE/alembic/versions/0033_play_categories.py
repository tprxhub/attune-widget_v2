"""Add categories above Play Plans while preserving every existing plan.

Revision ID: 0033_play_categories
Revises: 0032_organisation_billing
"""
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision = "0033_play_categories"
down_revision = "0032_organisation_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 0001 builds the current metadata on a fresh database; older deployed databases need
    # the table, foreign key and backfill below.
    inspector = sa.inspect(op.get_bind())
    if "play_categories" in inspector.get_table_names() and any(
        column["name"] == "category_id" for column in inspector.get_columns("play_plans")
    ):
        return
    # Development starts with create_all(), which can create this new table while leaving
    # the old play_plans table untouched. Complete that partial state without losing data.
    if "play_categories" not in inspector.get_table_names():
        op.create_table(
            "play_categories",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("created_by_label", sa.String(120)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("play_categories")}
    if "ix_play_categories_name" not in indexes:
        op.create_index("ix_play_categories_name", "play_categories", ["name"], unique=True)
    if "ix_play_categories_created_by_id" not in indexes:
        op.create_index("ix_play_categories_created_by_id", "play_categories", ["created_by_id"])
    op.add_column("play_plans", sa.Column("category_id", sa.String(36), nullable=True))

    connection = op.get_bind()
    plans = connection.execute(
        sa.text("SELECT id, name, sort_order, created_by_id, created_by_label FROM play_plans")
    ).mappings()
    for plan in plans:
        category_id = connection.execute(
            sa.text("SELECT id FROM play_categories WHERE name = :name"),
            {"name": plan["name"]},
        ).scalar_one_or_none()
        if category_id is None:
            category_id = str(uuid4())
            connection.execute(
                sa.text(
                    "INSERT INTO play_categories (id, name, sort_order, created_by_id, created_by_label) "
                    "VALUES (:id, :name, :sort_order, :created_by_id, :created_by_label)"
                ),
                {
                    "id": category_id,
                    "name": plan["name"],
                    "sort_order": plan["sort_order"],
                    "created_by_id": plan["created_by_id"],
                    "created_by_label": plan["created_by_label"],
                },
            )
        connection.execute(
            sa.text("UPDATE play_plans SET category_id = :category_id WHERE id = :plan_id"),
            {"category_id": category_id, "plan_id": plan["id"]},
        )

    # The original seed stored the category label as the plan name. Give those seven known
    # plans their existing shared dose title, while retaining the old label on the category.
    seeded_names = {
        "pinch-grip-development": ("Pinch & Grip Development", "Fix the Pencil Grip"),
        "bilateral-coordination": ("Bilateral Coordination & Midline Crossing", "Learn to Button a Shirt"),
        "visual-motor-integration": ("Visual-Motor Integration & Eye-Hand Coordination", "Make Reading Easy"),
        "tool-use-foundations": ("Tool Use Foundations & Functional Grasp", "Learn to Use Scissors"),
        "pre-handwriting-patterns": ("Pre-Handwriting Patterns & Line Mastery", "Color Inside the Lines"),
        "visual-scanning-tracking": ("Visual Scanning, Tracking & Matching", "Copy Correctly"),
        "pre-writing-shapes": ("Pre-Writing Shapes & Letter Readiness", "Write Their Name"),
    }
    for slug, (old_name, new_name) in seeded_names.items():
        connection.execute(
            sa.text(
                "UPDATE play_plans SET name = :new_name WHERE slug = :slug AND name = :old_name "
                "AND NOT EXISTS (SELECT 1 FROM play_plans WHERE name = :new_name)"
            ),
            {"slug": slug, "old_name": old_name, "new_name": new_name},
        )

    with op.batch_alter_table("play_plans") as batch:
        batch.alter_column("category_id", existing_type=sa.String(36), nullable=False)
        batch.create_foreign_key("fk_play_plans_category_id", "play_categories", ["category_id"], ["id"], ondelete="RESTRICT")
        batch.create_index("ix_play_plans_category_id", ["category_id"])


def downgrade() -> None:
    with op.batch_alter_table("play_plans") as batch:
        batch.drop_index("ix_play_plans_category_id")
        batch.drop_constraint("fk_play_plans_category_id", type_="foreignkey")
        batch.drop_column("category_id")
    op.drop_index("ix_play_categories_created_by_id", table_name="play_categories")
    op.drop_index("ix_play_categories_name", table_name="play_categories")
    op.drop_table("play_categories")
