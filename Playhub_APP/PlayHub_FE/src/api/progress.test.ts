import { describe, expect, test } from "bun:test";
import type { ApiProgress } from "./client";
import { assignedDoseNextStep, buildReport, progressNextSteps, reportFromApi } from "./progress";
import type { Attempt, PlayPlan } from "@/lib/types";

const attempt = (
  id: string,
  date: string,
  completion: number,
  mood: number,
  source: Attempt["source"] = "daily_check_in",
): Attempt => ({
  id,
  childId: "child-1",
  planId: "dose-1",
  entryId: "activity-1",
  goalId: "goal-1",
  level: "Starter",
  activity: "Peg activity",
  date,
  createdAt: `${date}T00:00:00Z`,
  completion,
  completionStatus: completion >= 2 ? "finished" : "stopped_early",
  helpLevel:
    completion === 5
      ? "independent"
      : completion === 4
        ? "one_reminder"
        : completion === 3
          ? "few_reminders"
          : completion === 2
            ? "hands_on"
            : null,
  supportScore:
    completion === 5
      ? 0
      : completion === 4
        ? 33
        : completion === 3
          ? 67
          : completion === 2
            ? 100
            : null,
  isRealLifeTry: false,
  weekNumber: 1,
  runNumber: 1,
  mood,
  bigWin: "Observable improvement",
  source,
  loggedBy: "Test Parent",
});

const plan: PlayPlan = {
  id: "dose-1",
  goalId: "goal-1",
  level: "Starter",
  title: "Tracked Dose",
  summary: "Test summary",
  kit: "Test kit",
  entries: [
    {
      id: "activity-1",
      kind: "dose",
      day: 0,
      label: "Activity #1",
      title: "Peg activity",
      activity: "Peg activity",
      loggable: true,
      minutes: 10,
      instructions: [],
      videoLabel: "Peg activity",
    },
  ],
};

describe("progress data flow", () => {
  test("builds local fallback metrics consistently", () => {
    const report = buildReport("child-1", [
      attempt("a1", "2026-01-01", 2, 3),
      attempt("a2", "2026-01-02", 3, 4),
      attempt("a3", "2026-01-03", 5, 5, "play_dose"),
    ]);

    expect(report.totalSessions).toBe(3);
    expect(report.checkInCount).toBe(2);
    expect(report.activitiesCompleted).toBe(1);
    expect(report.lastCheckIn).toBe("2026-01-03");
    expect(report.supportScore).toBe(0);
    expect(report.latestSessionDate).toBe("2026-01-03");
  });

  test("uses the API trend and matching narrative as the single source of truth", () => {
    const summary: ApiProgress = {
      child_id: "child-1",
      total_attempts: 3,
      check_in_count: 2,
      activities_completed: 1,
      average_completion_score: 3.33,
      average_mood_score: 4,
      support_score: 71,
      last_check_in: "2026-01-03",
      // Deliberately differs from the client-side slope to guard against contradictory copy.
      trend: "decline",
      headline_status: "needs_check_in",
      fast_track_offered: false,
      move_down_offered: false,
      reminder_due: false,
      weekly_points: [
        {
          week_number: 1,
          week_start: "2026-01-01",
          week_end: "2026-01-07",
          play_plan_id: "goal-1",
          play_dose_id: "dose-1",
          level: "starter",
          support_score: 71,
          average_mood: 4,
          finished_count: 3,
          kit_sessions_logged: 5,
          real_life_try_passed: false,
          passed: false,
          complete: false,
          consult_suggested: false,
          days: [],
        },
      ],
      points: [
        ["a1", "2026-01-01", 5, "daily_check_in"],
        ["a2", "2026-01-02", 1, "daily_check_in"],
        ["a3", "2026-01-03", 5, "play_dose"],
      ].map(([id, occurredOn, completion, source]) => ({
        attempt_id: String(id),
        occurred_on: String(occurredOn),
        completion_score: Number(completion),
        mood_score: 4,
        play_plan_id: "goal-1",
        play_dose_id: "dose-1",
        activity_id: "activity-1",
        source: source as "daily_check_in" | "play_dose",
      })),
    };

    const report = reportFromApi(summary, [plan]);
    expect(report.status).toBe("no_data");
    // An incomplete dose describes current practice instead of a previous verdict.
    expect(report.headline).toBe("Starter dose in progress");
    expect(report.narrative).toContain("5 of 5 practice days logged at Starter");
    expect(report.supportScore).toBe(71);
    expect(report.latestSessionDate).toBe("2026-01-03");
    expect(report.checkInCount).toBe(2);
    expect(report.points[0]?.support).toBe(71);
    const nextSteps = progressNextSteps(report);
    // The dose is still in progress: finish it first. No placeholder steps.
    expect(nextSteps[0]?.title).toBe("Finish this Starter Play Dose");
    expect(nextSteps[0]?.body).toContain("5 of 5 practice days logged");
    expect(nextSteps.some((step) => step.body.includes("Activity #9"))).toBe(false);
  });
});

test("dashboard guidance uses the assigned Starter dose rather than a historical Pro narrative", () => {
  const report = buildReport("child-1", []);
  report.narrative = "Your child has just moved up to Pro";
  expect(assignedDoseNextStep(report, plan)).toContain("Continue Starter");
  expect(assignedDoseNextStep(report, plan)).not.toContain("Pro");
});
