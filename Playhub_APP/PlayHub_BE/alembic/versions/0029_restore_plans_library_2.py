"""Put back the last Plans library edits that deploys had reset (follow-up to 0028).

Found by checking the activity log against database backups:

- Bilateral Coordination Rookie: the activity list as saved by Dr Esther on 2026-10-21 (same
  titles and steps; the durations she cleared had been reset to 10 minutes).
- Pinch & Grip and Bilateral Coordination: the plan description and short description set in
  the Plans library on 2026-10-16.

Same rules as 0028: a row is only changed if it is unchanged since the backup used here, a
fresh database is left alone, and downgrade keeps the content.

Revision ID: 0029_restore_plans_library_2
Revises: 0028_restore_plans_library
"""
from __future__ import annotations

from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

from app.models import Activity, ActivityKind, PlayDose, PlayPlan, VideoSourceType

revision = "0029_restore_plans_library_2"
down_revision = "0028_restore_plans_library"
branch_labels = None
depends_on = None

RESTORE = {'doses': [{'id': 'cbcbaaee-710e-4d72-8471-f261906b3d5c',
            'label': 'Bilateral Coordination & Midline Crossing / Rookie / Learn to Button a Shirt',
            'activities': [{'id': '0f38d663-d06a-4af7-9f53-e461b015b3d7',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 0,
                            'day': 1,
                            'kind': 'ACTIVITY',
                            'title': 'Tap & Slide Stretch',
                            'instructions': ['Follow the activity card and video.',
                                             'Keep the session playful and short.'],
                            'instructions_html': None,
                            'video_source_type': None,
                            'video_url': None,
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': 'b0f08563-7a1c-4b20-8931-111eadbca881',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 1,
                            'day': 2,
                            'kind': 'ACTIVITY',
                            'title': 'Peg Hand Switch',
                            'instructions': ['Follow the activity card and video.',
                                             'Keep the session playful and short.'],
                            'instructions_html': None,
                            'video_source_type': None,
                            'video_url': None,
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '30ed4b57-c95b-42ba-ba1b-3052a752af9d',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 2,
                            'day': 3,
                            'kind': 'ACTIVITY',
                            'title': 'Block Buddy Tap',
                            'instructions': ['Follow the activity card and video.',
                                             'Keep the session playful and short.'],
                            'instructions_html': None,
                            'video_source_type': None,
                            'video_url': None,
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '1276aa9e-dbe1-4f69-bc2f-26e6c129e0e4',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 3,
                            'day': 4,
                            'kind': 'ACTIVITY',
                            'title': 'Twist Pair Dance',
                            'instructions': ['Follow the activity card and video.',
                                             'Keep the session playful and short.'],
                            'instructions_html': None,
                            'video_source_type': None,
                            'video_url': None,
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': 'e1bedf0c-cd36-4f15-b424-073582a27da8',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 4,
                            'day': 5,
                            'kind': 'ACTIVITY',
                            'title': 'Mirror Maze Draw',
                            'instructions': ['Follow the activity card and video.',
                                             'Keep the session playful and short.'],
                            'instructions_html': None,
                            'video_source_type': None,
                            'video_url': None,
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': False},
                           {'id': '809f6cee-f419-4917-93ce-d124747e389f',
                            'guard': '2026-10-21T14:13:28.13614+00:00',
                            'sequence': 5,
                            'day': 6,
                            'kind': 'ACTIVITY',
                            'title': 'Jar Twist',
                            'instructions': ['Loosen the lid slightly. The child holds the jar and twists '
                                             'the lid off and on 3 times, swapping hands once.'],
                            'instructions_html': None,
                            'video_source_type': None,
                            'video_url': None,
                            'duration_minutes': None,
                            'is_loggable': True,
                            'is_real_life_try': True}]}],
 'plans': [{'id': '91247bb9-c46b-4b36-9d1e-708c996840ab',
            'label': 'Pinch & Grip Development',
            'description': 'Pinch & Grip Development',
            'short_description': 'Fix the Pencil Grip',
            'guard_description': 'Build fingertip pinch, grip strength and a steady grasp, then carry it '
                                 'onto paper.',
            'guard_short_description': 'Build fingertip pinch, grip strength and a steady grasp, then carry '
                                       'it onto paper.'},
           {'id': '3e7ae5a6-f24b-486d-b9e0-56c2fc026cce',
            'label': 'Bilateral Coordination & Midline Crossing',
            'description': 'Bilateral Coordination & Midline Crossing',
            'short_description': 'Learn to Button a Shirt',
            'guard_description': 'Train two hands with different jobs and reaching across the middle.',
            'guard_short_description': 'Train two hands with different jobs and reaching across the '
                                       'middle.'}]}


def _when(value: str) -> datetime:
    return datetime.fromisoformat(value)


def upgrade() -> None:
    bind = op.get_bind()
    plans = PlayPlan.__table__
    for plan in RESTORE["plans"]:
        bind.execute(
            plans.update()
            .where(
                plans.c.id == plan["id"],
                plans.c.description == plan["guard_description"],
                plans.c.short_description == plan["guard_short_description"],
            )
            .values(description=plan["description"], short_description=plan["short_description"], updated_at=sa.func.now())
        )
    doses = PlayDose.__table__
    activities = Activity.__table__
    for dose in RESTORE["doses"]:
        if "summary" in dose:
            bind.execute(
                doses.update()
                .where(doses.c.id == dose["id"], doses.c.summary == dose["summary_guard"])
                .values(summary=dose["summary"], updated_at=sa.func.now())
            )
        rows = dose.get("activities")
        if not rows:
            continue
        current = {
            row.id: row.updated_at
            for row in bind.execute(
                sa.select(activities.c.id, activities.c.updated_at).where(activities.c.play_dose_id == dose["id"])
            )
        }
        # All or nothing per dose: skip it if its activities changed since the backup.
        if set(current) != {row["id"] for row in rows} or any(
            current[row["id"]] is None or _as_utc(current[row["id"]]) > _when(row["guard"]) for row in rows
        ):
            continue
        # Move sequences out of the way first; (play_dose_id, sequence) is unique.
        for offset, row in enumerate(rows):
            bind.execute(activities.update().where(activities.c.id == row["id"]).values(sequence=1000 + offset))
        for row in rows:
            bind.execute(
                activities.update()
                .where(activities.c.id == row["id"])
                .values(
                    sequence=row["sequence"],
                    day=row["day"],
                    kind=ActivityKind[row["kind"]],
                    title=row["title"],
                    instructions=row["instructions"],
                    instructions_html=row["instructions_html"],
                    video_source_type=VideoSourceType[row["video_source_type"]] if row["video_source_type"] else None,
                    video_url=row["video_url"],
                    duration_minutes=row["duration_minutes"],
                    is_loggable=row["is_loggable"],
                    is_real_life_try=row["is_real_life_try"],
                    updated_at=sa.func.now(),
                )
            )


def _as_utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes; Postgres returns aware ones.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def downgrade() -> None:
    # Restored content stays; there is nothing safe to undo.
    pass
