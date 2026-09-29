from datetime import date, timedelta

import pytest

from app.models import PlanLevel
from app.schemas import WeeklyProgressPoint
from app.services import _headline

START = date(2026, 7, 6)


def week(index, level, support, *, plan="plan-a", passed=False, mood=4.0):
    start = START + timedelta(days=7 * index)
    return WeeklyProgressPoint(
        week_number=index + 1,
        week_start=start,
        week_end=start + timedelta(days=6),
        play_plan_id=plan,
        play_dose_id=f"{plan}-{level}",
        level=PlanLevel(level),
        support_score=support,
        average_mood=mood,
        finished_count=3,
        kit_sessions_logged=3,
        real_life_try_passed=passed,
        passed=passed,
        consult_suggested=False,
    )


def test_no_scored_weeks_is_insufficient_data():
    assert _headline([]) == "insufficient_data"
    assert _headline([week(0, "starter", None)]) == "insufficient_data"


def test_a_single_week_at_a_level_is_settling_in():
    assert _headline([week(0, "starter", 60)]) == "settling_in"


def test_first_week_after_moving_level_is_settling_in():
    weeks = [week(0, "starter", 60), week(1, "starter", 47), week(2, "pro", 53)]

    assert _headline(weeks) == "settling_in"


def test_a_pass_in_the_last_three_weeks_is_progressing_even_on_a_new_level():
    weeks = [
        week(0, "starter", 60),
        week(1, "starter", 47),
        week(2, "starter", 20, passed=True),
        week(3, "pro", 53),
    ]

    assert _headline(weeks) == "progressing"


def test_an_old_pass_no_longer_counts():
    weeks = [
        week(0, "starter", 20, passed=True),
        week(1, "pro", 53),
        week(2, "pro", 53),
        week(3, "pro", 53),
    ]

    assert _headline(weeks) == "holding_steady"


@pytest.mark.parametrize(
    ("supports", "expected"),
    [
        ([60, 53, 53, 57], "holding_steady"),
        ([60, 53, 53, 46], "progressing"),
        ([60, 53, 53, 47], "holding_steady"),
        ([40, 40, 40, 47], "needs_check_in"),
        ([60, 66], "holding_steady"),
        ([60, 53], "progressing"),
        ([60, 67], "needs_check_in"),
    ],
)
def test_support_shift_of_seven_points_against_the_previous_weeks_decides_the_trend(
    supports, expected
):
    weeks = [week(index, "starter", support) for index, support in enumerate(supports)]

    assert _headline(weeks) == expected


def test_the_latest_week_is_compared_with_the_average_of_the_two_before_it():
    # A steady climb of 6 points a week is +9 against the average of the previous two weeks.
    steady_slide = [week(index, "rookie", support) for index, support in enumerate([40, 47, 53, 59])]
    gentle_drift = [week(index, "rookie", support) for index, support in enumerate([50, 52, 54, 56])]

    assert _headline(steady_slide) == "needs_check_in"
    assert _headline(gentle_drift) == "holding_steady"


def test_weeks_without_a_support_score_are_ignored():
    weeks = [
        week(0, "starter", 60),
        week(1, "starter", 53),
        week(2, "starter", 47),
        week(3, "starter", None),
    ]

    assert _headline(weeks) == "progressing"


def test_the_read_comes_from_the_latest_plan_only():
    other_plan = [week(index, "pro", 10, plan="plan-b") for index in range(3)]
    current_plan = [
        week(3, "starter", 40, plan="plan-a"),
        week(4, "starter", 40, plan="plan-a"),
        week(5, "starter", 60, plan="plan-a"),
    ]

    assert _headline(other_plan + current_plan) == "needs_check_in"
    # An earlier plan with a pass does not make the current plan look like it is progressing.
    passed_elsewhere = [week(0, "starter", 20, plan="plan-b", passed=True)]
    assert _headline(passed_elsewhere + current_plan) == "needs_check_in"
