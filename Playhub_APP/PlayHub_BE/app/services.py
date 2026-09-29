from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from datetime import date, timedelta

from app.models import (
    Attempt,
    AttemptSource,
    AuditEvent,
    CompletionStatus,
    HelpLevel,
    PlanLevel,
)
from app.schemas import ProgressPoint, ProgressSummary, WeeklyProgressPoint


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


def _weekly_points(ordered: Sequence[Attempt]) -> list[WeeklyProgressPoint]:
    grouped: dict[tuple[str, str, int, int], list[Attempt]] = defaultdict(list)
    for item in ordered:
        grouped[(item.play_plan_id, item.play_dose_id, item.run_number, item.week_number)].append(item)

    result: list[WeeklyProgressPoint] = []
    misses: dict[tuple[str, str, int], int] = defaultdict(int)
    for (plan_id, dose_id, run_number, week_number), rows in sorted(
        grouped.items(), key=lambda pair: min(item.occurred_on for item in pair[1])
    ):
        level = rows[0].play_dose.level
        kit_by_day: dict[int, Attempt] = {}
        real_life_rows: list[Attempt] = []
        for item in rows:
            if item.is_real_life_try or (item.activity and item.activity.is_real_life_try):
                real_life_rows.append(item)
            elif item.activity and item.activity.day and 1 <= item.activity.day <= 5:
                previous = kit_by_day.get(item.activity.day)
                if previous is None or (item.occurred_on, item.created_at) > (
                    previous.occurred_on,
                    previous.created_at,
                ):
                    kit_by_day[item.activity.day] = item

        kit_rows = list(kit_by_day.values())
        qualifying_days = {
            item.activity.day
            for item in kit_rows
            if item.completion_status == CompletionStatus.FINISHED
            and item.help_level in {HelpLevel.ONE_REMINDER, HelpLevel.INDEPENDENT}
            and item.activity
        }
        kit_passed = len(qualifying_days) >= 4 and {4, 5}.issubset(qualifying_days)
        allowed_try_help = (
            {HelpLevel.INDEPENDENT}
            if level == PlanLevel.PRO
            else {HelpLevel.ONE_REMINDER, HelpLevel.INDEPENDENT}
        )
        real_life_passed = any(
            item.completion_status == CompletionStatus.FINISHED and item.help_level in allowed_try_help
            for item in real_life_rows
        )
        passed = kit_passed and real_life_passed
        complete_week = bool(real_life_rows)
        miss_key = (plan_id, dose_id, run_number)
        if complete_week:
            misses[miss_key] = 0 if passed else misses[miss_key] + 1

        support = (
            round(sum(HELP_SUPPORT[item.help_level] for item in kit_rows) / len(kit_rows))
            if kit_rows
            else None
        )
        mood = round(sum(item.mood_score for item in kit_rows) / len(kit_rows), 2) if kit_rows else None
        week_start = min(item.occurred_on for item in rows)
        result.append(
            WeeklyProgressPoint(
                week_number=week_number,
                week_start=week_start,
                week_end=week_start + timedelta(days=6),
                play_plan_id=plan_id,
                play_dose_id=dose_id,
                level=level,
                support_score=support,
                average_mood=mood,
                finished_count=sum(
                    item.completion_status == CompletionStatus.FINISHED for item in kit_rows
                ),
                kit_sessions_logged=len(kit_rows),
                real_life_try_passed=real_life_passed,
                passed=passed,
                consult_suggested=complete_week and not passed and misses[miss_key] >= 2,
            )
        )
    return result


SUPPORT_SHIFT = 7


def _headline(weeks: Sequence[WeeklyProgressPoint]) -> str:
    """Weekly status for the Play Plan the child is working on now.

    Levels, passes and Support Scores only mean something inside one Play Plan, so the read is
    taken from that plan's series alone. It matches the weekly graph:

    * a pass in the last three weeks is always "progressing";
    * fewer than two weeks at the current level is "settling in";
    * otherwise the latest Support Score is compared with the average of the (up to) two weeks
      before it at this level: down by 7 or more is "progressing", up by 7 or more is
      "needs a check-in", anything else is "holding steady".
    """
    scored = [point for point in weeks if point.support_score is not None]
    if not scored:
        return "insufficient_data"
    series = [point for point in scored if point.play_plan_id == scored[-1].play_plan_id]
    if any(point.passed for point in series[-3:]):
        return "progressing"

    latest = series[-1]
    at_level: list[int] = []
    for point in reversed(series):
        if point.level != latest.level:
            break
        at_level.insert(0, point.support_score or 0)
    if len(at_level) < 2:
        return "settling_in"

    earlier = at_level[-3:-1]
    change = at_level[-1] - sum(earlier) / len(earlier)
    if change <= -SUPPORT_SHIFT:
        return "progressing"
    if change >= SUPPORT_SHIFT:
        return "needs_check_in"
    return "holding_steady"


def progress_summary(child_id: str, attempts: Sequence[Attempt]) -> ProgressSummary:
    ordered = sorted(attempts, key=lambda attempt: (attempt.occurred_on, attempt.created_at))
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
    weeks = _weekly_points(ordered)
    headline = _headline(weeks)
    trend = {
        "progressing": "progress",
        "holding_steady": "plateau",
        "needs_check_in": "decline",
        "settling_in": "insufficient_data",
        "insufficient_data": "insufficient_data",
    }[headline]
    if not any(point.support_score is not None for point in weeks):
        recent_legacy = ordered[-8:]
        if len(recent_legacy) >= 3:
            split = max(1, len(recent_legacy) // 2)
            before = sum(HELP_SUPPORT[item.help_level] for item in recent_legacy[:split]) / split
            after_rows = recent_legacy[split:]
            after = sum(HELP_SUPPORT[item.help_level] for item in after_rows) / len(after_rows)
            trend = "progress" if after < before else "decline" if after > before else "plateau"
            headline = {"progress": "progressing", "decline": "needs_check_in", "plateau": "holding_steady"}[trend]
    latest_week_support = next(
        (point.support_score for point in reversed(weeks) if point.support_score is not None), None
    )
    if latest_week_support is None:
        recent = ordered[-8:]
        latest_week_support = round(
            sum(HELP_SUPPORT[item.help_level] for item in recent) / len(recent)
        )

    latest_dose_id = ordered[-1].play_dose_id
    recent_three = [item for item in ordered if item.play_dose_id == latest_dose_id][-3:]
    fast_track = len(recent_three) == 3 and all(
        item.completion_status == CompletionStatus.FINISHED
        and item.help_level == HelpLevel.INDEPENDENT
        and item.mood_score >= 4
        for item in recent_three
    )
    move_down = len(recent_three) == 3 and all(
        item.help_level == HelpLevel.HANDS_ON
        or item.completion_status == CompletionStatus.STOPPED_EARLY
        or item.mood_score <= 2
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
        support_score=latest_week_support,
        last_check_in=last_check_in,
        trend=trend,
        points=_daily_points(ordered),
        headline_status=headline,
        fast_track_offered=fast_track,
        move_down_offered=move_down,
        reminder_due=bool(last_check_in and (date.today() - last_check_in).days >= 3),
        weekly_points=weeks,
    )


def audit(db, actor_id: str | None, action: str, resource_type: str, resource_id: str, metadata: dict | None = None) -> None:
    """Queue a compact append-only audit event in the caller's transaction."""
    db.add(AuditEvent(actor_id=actor_id, action=action, resource_type=resource_type,
                      resource_id=resource_id, metadata_json=metadata or {}))
