"""Play Progress Logic Spec: dose boundaries, pass rule and the five insight scenarios."""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.models import CompletionStatus, HelpLevel, PlanLevel
from app.services import _headline, _weekly_points

START = date(2026, 7, 6)
SCORE_HELP = {0: HelpLevel.INDEPENDENT, 33: HelpLevel.ONE_REMINDER, 67: HelpLevel.FEW_REMINDERS, 100: HelpLevel.HANDS_ON}
_clock = iter(range(10_000))


def session(day, score, *, level="starter", plan="plan-a", when=START, mood=4):
    """One logged session. `day` is 1-5 for practice or "try"; `score` None means not finished."""
    is_try = day == "try"
    return SimpleNamespace(
        play_plan_id=plan,
        play_dose_id=f"{plan}-{level}",
        play_dose=SimpleNamespace(level=PlanLevel(level)),
        activity=SimpleNamespace(day=None if is_try else day, is_real_life_try=is_try),
        is_real_life_try=is_try,
        completion_status=CompletionStatus.FINISHED if score is not None else CompletionStatus.STOPPED_EARLY,
        help_level=SCORE_HELP[score] if score is not None else None,
        mood_score=mood,
        occurred_on=when,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=next(_clock)),
    )


def dose(scores, try_score, *, start=START, **kw):
    rows = [session(i + 1, s, when=start + timedelta(days=i), **kw) for i, s in enumerate(scores)]
    if try_score != "skip":
        rows.append(session("try", try_score, when=start + timedelta(days=5), **kw))
    return rows


def test_dose_support_score_is_the_flat_average_of_finished_days_including_the_try():
    [point] = _weekly_points(dose([100, 67, None, 33, 0], 33))
    assert point.support_score == pytest.approx((100 + 67 + 33 + 0 + 33) / 5)
    assert point.complete and point.real_life_try_passed
    assert point.passed is False  # only 2 practice days at one reminder or less


def test_four_easy_practice_days_and_a_passed_try_pass_the_dose():
    [point] = _weekly_points(dose([67, 33, 33, 0, 0], 0))
    assert point.passed and point.scenario == "first"


def test_a_dose_without_a_finished_try_is_in_progress_with_no_scenario():
    [point] = _weekly_points(dose([33, 33], "skip") + [session("try", None)])
    assert point.complete is False and point.scenario is None


def test_a_dose_ends_at_its_finished_try_so_logging_again_is_a_redo():
    first = dose([100, 67, 67, 33, 67], 67)
    redo = dose([33, 0, 33, 0, 33], 0, start=START + timedelta(days=7))
    points = _weekly_points(first + redo)
    assert [p.week_number for p in points] == [1, 2]
    assert [p.passed for p in points] == [False, True]


def test_a_slow_dose_is_still_one_dose_across_calendar_weeks():
    rows = [session(d, 33, when=START + timedelta(days=4 * d)) for d in range(1, 6)] + [
        session("try", 0, when=START + timedelta(days=25))
    ]
    assert len(_weekly_points(rows)) == 1


def test_moving_up_a_level_is_settling_in_even_after_a_pass():
    rows = dose([33, 0, 33, 0, 0], 0) + dose([67, 67, 33, 67, 67], 67, level="pro", start=START + timedelta(days=7))
    assert [p.scenario for p in _weekly_points(rows)] == ["first", "settling"]


def test_two_fails_in_a_row_at_the_same_level_is_book_a_play_consult():
    rows = dose([100, 67, 67, 33, 67], 67) + dose([100, 67, 67, 67, 67], 67, start=START + timedelta(days=7))
    points = _weekly_points(rows)
    assert points[1].scenario == "consult" and points[1].consult_suggested


@pytest.mark.parametrize(("day1", "day5", "expected"), [(100, 33, "progressing"), (67, 33, "progressing"), (33, 0, "steady")])
def test_progressing_needs_day_five_at_least_34_points_below_day_one(day1, day5, expected):
    rows = dose([0, 0, 0, 0, 0], 0) + dose([day1, 33, 33, 33, day5], 33, start=START + timedelta(days=7))
    assert _weekly_points(rows)[1].scenario == expected


def test_the_headline_reads_the_latest_completed_dose_of_the_current_plan():
    rows = dose([33, 0, 33, 0, 0], 0) + dose([67, 67, 33, 67, 67], 67, level="pro", start=START + timedelta(days=7))
    other = dose([0, 0, 0, 0, 0], 0, plan="plan-b", start=START + timedelta(days=20))
    points = _weekly_points(rows + other)
    assert _headline(points, "plan-a") == "settling_in"
    assert _headline(points, "plan-b") == "first_dose"
    assert _headline(_weekly_points(dose([33], "skip")), "plan-a") == "insufficient_data"


def test_moving_down_does_not_claim_a_move_up():
    rows = dose([33, 0, 33, 0, 0], 0, level="pro") + dose([33, 33, 33, 33, 33], 33, level="starter", start=START + timedelta(days=7))
    assert _weekly_points(rows)[1].scenario != "settling"


def test_incomplete_current_dose_does_not_show_a_previous_level_verdict():
    rows = dose([33, 0, 33, 0, 0], 0) + dose([67, 67, 33, 67, 67], 67, level="pro", start=START + timedelta(days=7)) + [session(1, 33, level="starter", when=START + timedelta(days=20))]
    assert _headline(_weekly_points(rows), "plan-a") == "insufficient_data"
