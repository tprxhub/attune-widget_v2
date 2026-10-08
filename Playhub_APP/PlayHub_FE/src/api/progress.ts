import type { Attempt, ProgressReport, StatusKey } from "@/lib/types";
import { apiRequest, type ApiProgress } from "./client";
import { listPlans } from "./plans";
import type { PlayPlan } from "@/lib/types";
import { insightFor } from "@/features/progress/insights";

export const STATUS_META: Record<
  StatusKey,
  { label: string; token: "blue" | "amber" | "coral" | "navy"; hint: string }
> = {
  first_dose: {
    label: "First dose at this level",
    token: "amber",
    hint: "The first Play Dose in this plan is complete.",
  },
  settling_in: {
    label: "Settling in",
    token: "navy",
    hint: "Just moved up a level, so a bit more support is natural.",
  },
  progressing: {
    label: "Progressing",
    token: "blue",
    hint: "Needed less help by the end of the dose than at the start.",
  },
  holding_steady: {
    label: "Holding steady",
    token: "amber",
    hint: "About the same support as at the start of the dose.",
  },
  needs_check_in: {
    label: "Book a Play Consult",
    token: "coral",
    hint: "The Real-Life Try wasn’t passed for two doses in a row.",
  },
  no_data: {
    label: "Dose in progress",
    token: "navy",
    hint: "Log the five practice days and the Real-Life Try to complete a Play Dose.",
  },
};

/** Points of the plan the child is on now, in the order they happened. */
export function currentPlanDoses(report: ProgressReport) {
  const planId = report.currentPlanId ?? report.points.at(-1)?.planId;
  return report.points.filter((point) => point.planId === planId);
}

/** An insight appears only when the latest dose of the current plan is complete. */
export function latestInsight(report: ProgressReport) {
  const doses = currentPlanDoses(report);
  return doses.at(-1)?.complete ? insightFor(doses, doses.length - 1) : null;
}

/** Dashboard guidance follows the assigned dose, including when history ends at another level. */
export function assignedDoseNextStep(
  report: ProgressReport | undefined,
  plan: PlayPlan | undefined,
) {
  if (!plan) return "Choose a Play Dose to get started.";
  const doses = report?.points.filter((point) => point.planId === plan.goalId) ?? [];
  const latestIndex = [...doses].reverse().findIndex((point) => point.doseId === plan.id);
  const index = latestIndex < 0 ? -1 : doses.length - 1 - latestIndex;
  const latest = doses[index];
  const insight = insightFor(doses, index);
  if (insight) return insight.next;
  return `Continue ${plan.level} with today’s activity. ${latest?.kitSessionsLogged ?? 0} of 5 practice days logged. Complete the practice days and Real-Life Try to see how this dose went.`;
}

function messaging(
  status: StatusKey,
  points: ProgressReport["points"],
  currentPlanId: string | null,
) {
  const doses = points.filter((point) => point.planId === (currentPlanId ?? points.at(-1)?.planId));
  const latest = doses.at(-1);
  const insight = latest?.complete ? insightFor(doses, doses.length - 1) : null;
  return insight
    ? { headline: insight.title, narrative: insight.seeing }
    : latest && !latest.complete
      ? {
          headline: `${latest.level} dose in progress`,
          narrative: `${latest.kitSessionsLogged} of 5 practice days logged at ${latest.level}. Continue this dose and log the Real-Life Try to see the next step.`,
        }
      : { headline: STATUS_META[status].label, narrative: STATUS_META[status].hint };
}

/** "What's next?" for the current plan, then any timely nudges. Nothing here is free-form. */
export function progressNextSteps(report: ProgressReport) {
  const steps: Array<{ title: string; body: string }> = [];
  const doses = currentPlanDoses(report);
  const latest = doses.at(-1);
  const insight = latestInsight(report);
  if (latest && !latest.complete) {
    steps.push({
      title: `Finish this ${latest.level} Play Dose`,
      body: `${latest.kitSessionsLogged} of 5 practice days logged. Log the remaining days and the Real-Life Try to see how this dose went.`,
    });
  }
  if (insight) steps.push({ title: insight.title, body: insight.next });
  if (report.fastTrackOffered)
    steps.push({
      title: "Real-Life Try is ready early",
      body: "Three sessions in a row were finished on their own with a happy mood. Try the Real-Life skill now, or stay and master this level.",
    });
  if (report.reminderDue)
    steps.push({
      title: "Continue this week",
      body: "No session has been logged for three days. A short, playful session will keep the routine moving.",
    });
  if (!steps.length)
    steps.push({
      title: "Log the first session",
      body: "Pick today’s activity on the Daily Check-In. Progress appears once Day 1 is logged.",
    });
  return steps;
}

export function buildReport(childId: string, rows: Attempt[]): ProgressReport {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.at(-1);
  const averageMood = sorted.length
    ? Number((sorted.reduce((sum, row) => sum + row.mood, 0) / sorted.length).toFixed(1))
    : 0;
  const supportScore =
    [...sorted].reverse().find((row) => row.supportScore !== null)?.supportScore ?? null;
  const status: StatusKey = "no_data";
  return {
    childId,
    status,
    currentPlanId: last?.goalId ?? null,
    ...messaging(status, [], null),
    lastCheckIn: last?.date ?? null,
    latestSessionDate: last?.date ?? null,
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
  const currentPlanId = summary.current_play_plan_id ?? summary.points.at(-1)?.play_plan_id ?? null;
  const points: ProgressReport["points"] = summary.weekly_points.map((point) => ({
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
    complete: point.complete,
    consultSuggested: point.consult_suggested,
    scenario: point.scenario ?? null,
    days: point.days.map((day) => ({
      day: day.day,
      isTry: day.is_try,
      date: day.occurred_on,
      finished: day.finished,
      helpLevel: day.help_level,
      score: day.score,
      mood: day.mood,
      tryPassed: day.try_passed,
    })),
  }));
  return {
    childId: summary.child_id,
    status: points.at(-1)?.complete === false ? "no_data" : status,
    currentPlanId,
    ...messaging(status, points, currentPlanId),
    lastCheckIn: summary.last_check_in,
    latestSessionDate: summary.points.at(-1)?.occurred_on ?? summary.last_check_in,
    totalSessions: summary.total_attempts,
    checkInCount: summary.check_in_count,
    activitiesCompleted: summary.activities_completed,
    // The dose score is stored unrounded (spec); round only where it is shown.
    supportScore: summary.support_score === null ? null : Math.round(summary.support_score),
    points,
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
