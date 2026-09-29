import type { Attempt, ProgressReport, StatusKey } from "@/lib/types";
import { apiRequest, type ApiProgress } from "./client";
import { listPlans } from "./plans";
import type { PlayPlan } from "@/lib/types";

export const STATUS_META: Record<
  StatusKey,
  { label: string; token: "blue" | "amber" | "coral" | "navy"; hint: string }
> = {
  progressing: {
    label: "Progressing",
    token: "blue",
    hint: "Needing less support, or moving up a level.",
  },
  holding_steady: {
    label: "Holding steady",
    token: "amber",
    hint: "About the same for a few weeks. Keep going.",
  },
  needs_check_in: {
    label: "Needs a check-in",
    token: "coral",
    hint: "Needing more support each week.",
  },
  settling_in: {
    label: "Settling in",
    token: "navy",
    hint: "New level. Give it a week or two.",
  },
  no_data: {
    label: "Not enough data",
    token: "navy",
    hint: "Log the five kit sessions and Real-Life Try to complete a week.",
  },
};

const messaging = (status: StatusKey) => ({
  headline: STATUS_META[status].label,
  narrative: STATUS_META[status].hint,
});

export function progressNextSteps(report: ProgressReport) {
  const steps: Array<{ title: string; body: string }> = [];
  const baselineSteps = [
    {
      title: "Step 1",
      body: "Continue Child A through Starter Activity #9 to maintain momentum. For Child B, hold at the current Forerunner level and aim for 2–3 more consecutive sessions before considering advancement — an improving mood score above 3 is the key signal to watch.",
    },
    {
      title: "Step 2",
      body: "This child has completed all four Bilateral Coordination Forerunner activities. Introduce Starter-level Bilateral Coordination (Activity #6) in the next session — consistent 5/5 scores and high mood indicate clear readiness for the next tier.",
    },
    {
      title: "Step 3",
      body: "Log 2–3 more Visual-Motor Integration sessions to build a baseline for that goal. For Pinch & Grip, consider introducing Starter Activity #8 or #9 to continue advancing — the Feb 2026 results show readiness to push further on both tracks.",
    },
    {
      title: "Step 4",
      body: "Prioritise consistent weekly check-ins over the next month. If Bilateral Coordination scores remain at 3/5 after 2–3 more sessions, consider returning to Pinch & Grip Forerunner activities to rebuild confidence before re-attempting Bilateral at higher frequency.",
    },
    {
      title: "Step 5",
      body: "Schedule at least 3 check-ins over the next two weeks and log each one. Starting with Forerunner Activity #1 or #3 may help build a stronger baseline — simpler activities will give a clearer picture of capability and mood before returning to Activity #2.",
    },
  ];
  if (report.fastTrackOffered)
    steps.push({
      title: "Real-Life Try is ready early",
      body: "Three sessions in a row were finished independently with a happy mood. Try the Real-Life skill now, or stay and master this level.",
    });
  if (report.moveDownOffered)
    steps.push({
      title: "Consider the level below",
      body: "The latest three sessions needed hands-on help, stopped early or had a low mood. Offer the easier level without losing earlier progress.",
    });
  if (report.points.at(-1)?.consultSuggested)
    steps.push({
      title: "Suggest a Play Consult",
      body: "This level was not passed twice in a row. A Play Consult can adapt the plan before a third week.",
    });
  if (report.reminderDue)
    steps.push({
      title: "Continue this week",
      body: "No session has been logged for three days. A short, playful session will keep the routine moving.",
    });
  if (!steps.length) steps.push(...baselineSteps);
  return steps;
}

export function buildReport(childId: string, rows: Attempt[]): ProgressReport {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.at(-1);
  const averageMood = sorted.length
    ? Number((sorted.reduce((sum, row) => sum + row.mood, 0) / sorted.length).toFixed(1))
    : 0;
  const supportScore = sorted.length
    ? Math.round(sorted.reduce((sum, row) => sum + row.supportScore, 0) / sorted.length)
    : null;
  const status: StatusKey = "no_data";
  return {
    childId,
    status,
    ...messaging(status),
    lastCheckIn: last?.date ?? null,
    totalSessions: sorted.length,
    checkInCount: sorted.filter((row) => row.source === "daily_check_in").length,
    activitiesCompleted: new Set(sorted.map((row) => row.entryId)).size,
    supportScore,
    points: [],
    averageCompletion: sorted.length
      ? Number((sorted.reduce((sum, row) => sum + row.completion, 0) / sorted.length).toFixed(1))
      : 0,
    averageMood,
    fastTrackOffered: false,
    moveDownOffered: false,
    reminderDue: false,
  };
}

export function reportFromApi(summary: ApiProgress, _plans: PlayPlan[]): ProgressReport {
  const status: StatusKey =
    summary.headline_status === "insufficient_data" ? "no_data" : summary.headline_status;
  return {
    childId: summary.child_id,
    status,
    ...messaging(status),
    lastCheckIn: summary.last_check_in,
    totalSessions: summary.total_attempts,
    checkInCount: summary.check_in_count,
    activitiesCompleted: summary.activities_completed,
    supportScore: summary.support_score,
    points: summary.weekly_points.map((point) => ({
      date: point.week_start,
      weekNumber: point.week_number,
      support: point.support_score,
      mood: point.average_mood,
      level: point.level === "rookie" ? "Rookie" : point.level === "pro" ? "Pro" : "Starter",
      planId: point.play_plan_id,
      doseId: point.play_dose_id,
      finishedCount: point.finished_count,
      kitSessionsLogged: point.kit_sessions_logged,
      realLifeTryPassed: point.real_life_try_passed,
      passed: point.passed,
      consultSuggested: point.consult_suggested,
    })),
    averageCompletion: summary.average_completion_score ?? 0,
    averageMood: summary.average_mood_score ?? 0,
    fastTrackOffered: summary.fast_track_offered,
    moveDownOffered: summary.move_down_offered,
    reminderDue: summary.reminder_due,
  };
}

export async function getProgress(childId: string): Promise<ProgressReport> {
  const [summary, plans] = await Promise.all([
    apiRequest<ApiProgress>(`/children/${childId}/progress`),
    listPlans(),
  ]);
  return reportFromApi(summary, plans);
}

export async function getProgressForChildren(childIds: string[]): Promise<ProgressReport[]> {
  return Promise.all(childIds.map(getProgress));
}
