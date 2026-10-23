"""Put back the plain-text steps of two Pinch & Grip Rookie activities.

"Peg Push Party" and "PathPad Fun" kept their formatted steps through the deploy resets, but
their plain-text copy (used by Ask Attune) was reset to the generic catalogue line on
2026-10-20 and never re-entered. This restores the plain text saved alongside the same
formatted steps on 2026-10-20. A row is only changed if it still holds the generic line and
is unchanged since the backup.

Revision ID: 0030_restore_plain_steps
Revises: 0029_restore_plans_library_2
"""
from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

from app.models import Activity

revision = "0030_restore_plain_steps"
down_revision = "0029_restore_plans_library_2"
branch_labels = None
depends_on = None

GENERIC = ["Follow the activity card and video.", "Keep the session playful and short."]
RESTORE = [{'id': '04687fd0-a72b-47a6-8491-6d94a2f74ed6',
  'guard': '2026-10-23T17:52:28.139977+00:00',
  'instructions': ['Toy: Pathpad + Pen',
                   'Goal: Activate thumb and finger pincer grasp',
                   'Activity Level: Forerunner',
                   'Steps:',
                   'Lay the Pathpad flat.',
                   'Have the child push down using the stylus with thumb and index finger.',
                   'Move from point to point using gentle pinches.',
                   'Encourage them to use the other hand to stabilize the PathPad.',
                   'Bonus Tip: Use color codes to add step-by-step fun.',
                   'Tools Needed: Pathpad, Pen',
                   'Setup Needed: None',
                   'Skill Ratings:',
                   '✏️ Handwriting: ⭐⭐⭐⭐ (4),',
                   '🧍 Bilateral Coordination: ⭐⭐ (2)',
                   'Interest: ⭐⭐⭐⭐☆ (4/5)',
                   'Parent Win: "My child used their thumb and fingers with better coordination."'],
  'title': 'PathPad Fun'},
 {'id': '6db1e07d-704f-41f6-a281-4fa6d64dfa67',
  'guard': '2026-10-23T17:52:28.139977+00:00',
  'instructions': ["Toy: Pegs n' Frame",
                   'Goal: Improve vertical grasp and release',
                   'Activity Level: Forerunner',
                   'Steps:',
                   'Provide a few pegs and the frame (10-15 pegs at a time).',
                   'Ask the child to push each peg into a hole with one hand.',
                   'Bonus Tip: Place only a few pegs at a time to support motivation. You could also use a '
                   'timer races to add excitement!',
                   'Tools Needed: Pegs and Frame',
                   'Setup Needed: None',
                   'Skill Ratings:',
                   '✏️ Handwriting: ⭐⭐ (2),',
                   '🧍 Bilateral Coordination: ⭐⭐ (2)',
                   'Interest: ⭐⭐⭐☆ (3/5)',
                   'Parent Win: "He used just one hand without switching!"'],
  'title': 'Peg Push Party'}]


def upgrade() -> None:
    bind = op.get_bind()
    activities = Activity.__table__
    for row in RESTORE:
        current = bind.execute(
            sa.select(activities.c.instructions, activities.c.updated_at).where(activities.c.id == row["id"])
        ).first()
        if current is None or current.instructions != GENERIC:
            continue
        updated = current.updated_at if current.updated_at.tzinfo else current.updated_at.replace(tzinfo=timezone.utc)
        if updated > datetime.fromisoformat(row["guard"]):
            continue
        bind.execute(
            activities.update()
            .where(activities.c.id == row["id"])
            .values(instructions=row["instructions"], updated_at=sa.func.now())
        )


def downgrade() -> None:
    pass
