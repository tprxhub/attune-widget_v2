"""Add published, invisible and locked states to Play Plans.

Revision ID: 0017_plan_publication_status
Revises: 0016_apple_microsoft_sign_in
"""
from alembic import op
import sqlalchemy as sa

revision = "0017_plan_publication_status"
down_revision = "0016_apple_microsoft_sign_in"
branch_labels = None
depends_on = None

STATUS = sa.Enum("PUBLISHED", "INVISIBLE", "LOCKED", name="planpublicationstatus")


def upgrade() -> None:
    bind = op.get_bind()
    existing = {column["name"] for column in sa.inspect(bind).get_columns("play_plans")}
    if "publication_status" not in existing:
        # Postgres needs the enum type to exist before a column can use it (no-op on SQLite).
        STATUS.create(bind, checkfirst=True)
        op.add_column(
            "play_plans",
            sa.Column(
                "publication_status",
                STATUS,
                nullable=False,
                server_default="PUBLISHED",
            ),
        )


def downgrade() -> None:
    with op.batch_alter_table("play_plans") as batch:
        batch.drop_column("publication_status")
    STATUS.drop(op.get_bind(), checkfirst=True)
