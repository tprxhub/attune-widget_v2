"""Play Pulse contacts (the form shown before a guest's result) and finished checks.

Revision ID: 0023_play_pulse
Revises: 0022_attune
"""
from alembic import op
import sqlalchemy as sa

revision = "0023_play_pulse"
down_revision = "0022_attune"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "play_pulse_contacts" not in tables:
        op.create_table(
            "play_pulse_contacts",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("phone", sa.String(32), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_play_pulse_contacts_email", "play_pulse_contacts", ["email"], unique=True)
    if "play_pulse_results" not in tables:
        op.create_table(
            "play_pulse_results",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "contact_id", sa.String(36),
                sa.ForeignKey("play_pulse_contacts.id", ondelete="CASCADE"), nullable=True,
            ),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("child_name", sa.String(80), nullable=False),
            sa.Column("age_band", sa.String(16), nullable=False),
            sa.Column("goal_id", sa.String(40), nullable=False),
            sa.Column("goal_name", sa.String(120), nullable=False),
            sa.Column("support_score", sa.Integer(), nullable=False),
            sa.Column("tier", sa.String(16), nullable=False),
            sa.Column("areas_on_track", sa.Integer(), nullable=False),
            sa.Column("areas_assessed", sa.Integer(), nullable=False),
            sa.Column("domain_tiers", sa.JSON(), nullable=False),
            sa.Column("answers", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        for column in ("contact_id", "user_id", "goal_id", "tier", "created_at"):
            op.create_index(f"ix_play_pulse_results_{column}", "play_pulse_results", [column])


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "play_pulse_results" in tables:
        op.drop_table("play_pulse_results")
    if "play_pulse_contacts" in tables:
        op.drop_table("play_pulse_contacts")
