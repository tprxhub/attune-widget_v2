from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from datetime import date

from app.models import (
    Attempt,
    AttemptSource,
    AuditEvent,
    CompletionStatus,
    HelpLevel,
)
from app.schemas import ProgressDay, ProgressPoint, ProgressSummary, WeeklyProgressPoint


HELP_SUPPORT = {
    HelpLevel.INDEPENDENT: 0,
    HelpLevel.ONE_REMINDER: 33,
    HelpLevel.FEW_REMINDERS: 67,
    HelpLevel.HANDS_ON: 100,
}


def _daily_points(ordered: Sequence[Attempt]) -> list[ProgressPoint]:
    return [
        ProgressPoint(
            attempt_id=item.id,
            occurred_on=item.occurred_on,
            completion_score=item.completion_score,
            mood_score=item.mood_score,
            play_plan_id=item.play_plan_id,
            play_dose_id=item.play_dose_id,
            activity_id=item.activity_id,
            source=item.source,
        )
        for item in ordered
    ]


def _is_finished(item: Attempt) -> bool:
    """A session counts (and scores) only when the child finished and a help level was recorded."""
    return item.completion_status == CompletionStatus.FINISHED and item.help_level is not None


def _is_try(item: Attempt) -> bool:
    return bool(item.is_real_life_try or (item.activity and item.activity.is_real_life_try))


def _order(item: Attempt) -> tuple:
    return (item.occurred_on, item.created_at)


EASY = {HelpLevel.ONE_REMINDER, HelpLevel.INDEPENDENT}

# Insight scenario (Logic Spec, "Insight logic") -> headline status used by badges and filters.
SCENARIO_STATUS = {
    "first": "first_dose",
    "settling": "settling_in",
    "consult": "needs_check_in",
    "progressing": "progressing",
    "steady": "holding_steady",
}


def _dose_runs(ordered: Sequence[Attempt]) -> list[list[Attempt]]:
    """Split each Play Dose's sessions into runs ("doses" in the spec), in the order they happened.

    A dose is one pass through a level: practice days plus a Real-Life Try. It ends when the Try is
    finished, so anything logged on the same Play Dose afterwards is a redo, a new dose at the same
    level. Calendar weeks play no part, so a dose that takes ten days is still one dose.
    """
    by_dose: dict[tuple[str, str], list[Attempt]] = defaultdict(list)
    for item in ordered:
        by_dose[(item.play_plan_id, item.play_dose_id)].append(item)
    runs: list[list[Attempt]] = []
    for rows in by_dose.values():
        current: list[Attempt] = []
        for item in sorted(rows, key=_order):
            current.append(item)
            if _is_try(item) and _is_finished(item):
                runs.append(current)
                current = []
        if current:
            runs.append(current)
    return sorted(runs, key=lambda run: _order(run[0]))


def _scenario(point: WeeklyProgressPoint, previous: WeeklyProgressPoint | None) -> str:
    """First match wins, top to bottom (Logic Spec). `previous` is the plan's last completed dose."""
    if previous is None:
        return "first"
    if previous.level != point.level:
        return "settling"
    if not point.passed and not previous.passed:
        return "consult"
    practice = {day.day: day for day in point.days if not day.is_try and day.day is not None}
    first, fifth = practice.get(1), practice.get(5)
    if first and fifth and first.score is not None and fifth.score is not None and first.score - fifth.score >= 34:
        return "progressing"
    return "steady"


def _weekly_points(ordered: Sequence[Attempt]) -> list[WeeklyProgressPoint]:
    """One point per dose (Logic Spec):

    * Dose Support Score is the flat average of the scores of every finished day, the Real-Life
      Try included. Unfinished days are not counted, and nothing is averaged across doses.
    * A dose is complete once its Real-Life Try is finished; before that it has no verdict.
    * It passes when at least 4 of the 5 practice days were finished with one reminder or less
      and the Real-Life Try passed (finished with one reminder or less).
    * Each completed dose gets one insight scenario; failing twice in a row suggests a Play Consult.
    """
    result: list[WeeklyProgressPoint] = []
    last_complete: dict[str, WeeklyProgressPoint] = {}
    run_counter: dict[tuple[str, str], int] = defaultdict(int)
    for rows in _dose_runs(ordered):
        plan_id, dose_id = rows[0].play_plan_id, rows[0].play_dose_id
        run_counter[(plan_id, dose_id)] += 1
        kit_by_day: dict[int, Attempt] = {}
        try_rows: list[Attempt] = []
        for item in rows:
            if _is_try(item):
                try_rows.append(item)
            elif item.activity and item.activity.day and 1 <= item.activity.day <= 5:
                # A day logged twice keeps its latest entry.
                kit_by_day[item.activity.day] = item

        kit_rows = [kit_by_day[day] for day in sorted(kit_by_day)]
        try_row = try_rows[-1] if try_rows else None
        try_finished = try_row is not None and _is_finished(try_row)
        try_passed = bool(try_finished and try_row.help_level in EASY)
        kit_passed = sum(_is_finished(item) and item.help_level in EASY for item in kit_rows) >= 4
        passed = try_finished and kit_passed and try_passed

        def day_of(item: Attempt, is_try: bool) -> ProgressDay:
            done = _is_finished(item)
            return ProgressDay(
                day=None if is_try else item.activity.day,
                is_try=is_try,
                occurred_on=item.occurred_on,
                finished=done,
                help_level=item.help_level if done else None,
                score=HELP_SUPPORT[item.help_level] if done else None,
                mood=item.mood_score if done else None,
                try_passed=(try_passed if done else None) if is_try else None,
            )

        days = [day_of(item, False) for item in kit_rows]
        if try_row is not None:
            days.append(day_of(try_row, True))
        finished_days = [day for day in days if day.finished]
        support = sum(day.score or 0 for day in finished_days) / len(finished_days) if finished_days else None
        mood = round(sum(day.mood or 0 for day in finished_days) / len(finished_days), 2) if finished_days else None
        start = min(item.occurred_on for item in rows)
        point = WeeklyProgressPoint(
            week_number=run_counter[(plan_id, dose_id)],
            week_start=start,
            week_end=max(item.occurred_on for item in rows),
            play_plan_id=plan_id,
            play_dose_id=dose_id,
            level=rows[0].play_dose.level,
            support_score=support,
            average_mood=mood,
            finished_count=sum(_is_finished(item) for item in kit_rows),
            kit_sessions_logged=len(kit_rows),
            real_life_try_passed=try_passed,
            passed=passed,
            complete=try_finished,
            days=days,
        )
        if try_finished:
            scenario = _scenario(point, last_complete.get(plan_id))
            point.scenario = scenario
            point.consult_suggested = scenario == "consult"
            last_complete[plan_id] = point
        result.append(point)
    return result


def _headline(points: Sequence[WeeklyProgressPoint], current_plan_id: str | None) -> str:
    """The status badge reads the latest completed dose of the Play Plan the child is on now."""
    for point in reversed(points):
        if point.play_plan_id == current_plan_id and point.scenario:
            return SCENARIO_STATUS[point.scenario]
    return "insufficient_data"


def progress_summary(child_id: str, attempts: Sequence[Attempt]) -> ProgressSummary:
    ordered = sorted(attempts, key=_order)
    count = len(ordered)
    if not count:
        return ProgressSummary(
            child_id=child_id,
            total_attempts=0,
            check_in_count=0,
            activities_completed=0,
            average_completion_score=None,
            average_mood_score=None,
            support_score=None,
            last_check_in=None,
            trend="insufficient_data",
            points=[],
            reminder_due=False,
        )

    completion = sum(item.completion_score for item in ordered) / count
    mood = sum(item.mood_score for item in ordered) / count
    doses = _weekly_points(ordered)
    current_plan_id = ordered[-1].play_plan_id
    headline = _headline(doses, current_plan_id)
    trend = {
        "progressing": "progress",
        "holding_steady": "plateau",
        "needs_check_in": "decline",
    }.get(headline, "insufficient_data")
    # Summary cards show the latest Play Dose's own Support Score, never an average across doses.
    in_plan = [point for point in doses if point.play_plan_id == current_plan_id]
    latest_support = in_plan[-1].support_score if in_plan else None

    latest_dose_id = ordered[-1].play_dose_id
    recent_three = [item for item in ordered if item.play_dose_id == latest_dose_id][-3:]
    fast_track = len(recent_three) == 3 and all(
        _is_finished(item) and item.help_level == HelpLevel.INDEPENDENT and item.mood_score >= 4
        for item in recent_three
    )
    move_down = len(recent_three) == 3 and all(
        item.help_level == HelpLevel.HANDS_ON or not _is_finished(item) or item.mood_score <= 2
        for item in recent_three
    )
    check_ins = [item for item in ordered if item.source == AttemptSource.DAILY_CHECK_IN]
    last_check_in = check_ins[-1].occurred_on if check_ins else None
    return ProgressSummary(
        child_id=child_id,
        total_attempts=count,
        check_in_count=len(check_ins),
        activities_completed=len({item.activity_id for item in ordered if item.activity_id}),
        average_completion_score=round(completion, 2),
        average_mood_score=round(mood, 2),
        support_score=latest_support,
        last_check_in=last_check_in,
        trend=trend,
        points=_daily_points(ordered),
        headline_status=headline,
        current_play_plan_id=current_plan_id,
        fast_track_offered=fast_track,
        move_down_offered=move_down,
        reminder_due=bool(last_check_in and (date.today() - last_check_in).days >= 3),
        weekly_points=doses,
    )


def audit(db, actor_id: str | None, action: str, resource_type: str, resource_id: str, metadata: dict | None = None) -> None:
    """Queue a compact append-only audit event in the caller's transaction."""
    db.add(AuditEvent(actor_id=actor_id, action=action, resource_type=resource_type,
                      resource_id=resource_id, metadata_json=metadata or {}))
