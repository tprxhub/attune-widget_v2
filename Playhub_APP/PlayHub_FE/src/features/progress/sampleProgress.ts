import type { HelpLevel, InsightScenario, Level, ProgressDay, ProgressPoint } from "@/lib/types";

/**
 * A made-up child's journey for the public home page, so visitors can see the real Progress
 * chart before signing up. It follows the same rules as the API: scores 0/33/67/100 by help
 * level, a dose ends at its Real-Life Try, and the pass rule is 4 of 5 practice days plus the
 * Try at one reminder or less.
 */

export const SAMPLE_PLANS = [
  { id: "sample-threading", title: "Threading & Lacing" },
  { id: "sample-pincer", title: "Pincer Grip" },
] as const;

const HELP: Record<number, HelpLevel> = {
  0: "independent",
  33: "one_reminder",
  67: "few_reminders",
  100: "hands_on",
};

/** Practice-day scores (null = not finished in 15 minutes), then the Try (undefined = not yet). */
interface SampleDose {
  planId: string;
  level: Level;
  practice: Array<number | null>;
  tryScore?: number;
  moods: number[];
  scenario: InsightScenario | null;
}

const DOSES: SampleDose[] = [
  { planId: "sample-threading", level: "Rookie", practice: [67, 33, 33, 0, 0], tryScore: 33, moods: [3, 4, 4, 5, 5, 5], scenario: "first" },
  { planId: "sample-threading", level: "Starter", practice: [100, 67, 67, 33, 67], tryScore: 67, moods: [2, 3, 3, 4, 3, 3], scenario: "settling" },
  { planId: "sample-threading", level: "Starter", practice: [67, 33, 33, 0, 33], tryScore: 0, moods: [3, 4, 4, 5, 4, 5], scenario: "progressing" },
  { planId: "sample-threading", level: "Pro", practice: [67, 33, 33, 33, 0], tryScore: 33, moods: [3, 4, 4, 4, 5, 5], scenario: "settling" },
  { planId: "sample-pincer", level: "Rookie", practice: [33, 33, 0, 0, 0], tryScore: 0, moods: [4, 4, 5, 5, 5, 5], scenario: "first" },
  { planId: "sample-pincer", level: "Starter", practice: [100, 67, 33, 33, 0], tryScore: 33, moods: [3, 3, 4, 4, 5, 4], scenario: "settling" },
  { planId: "sample-pincer", level: "Starter", practice: [67, 33, null], moods: [3, 4], scenario: null },
];

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const easy = (score: number | null | undefined) => score !== null && score !== undefined && score <= 33;

/** Dates count back from `today`, so the sample always looks recent. */
export function sampleProgressPoints(today = new Date()): ProgressPoint[] {
  const totalDays = DOSES.reduce((sum, dose) => sum + dose.practice.length + (dose.tryScore === undefined ? 0 : 1) + 1, 0);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate() - totalDays);
  const runs = new Map<string, number>();

  return DOSES.map((dose, index) => {
    let moodIndex = 0;
    const day = (n: number | null, score: number | null, isTry: boolean): ProgressDay => {
      cursor.setDate(cursor.getDate() + 1);
      const finished = score !== null;
      return {
        day: n,
        isTry,
        date: iso(cursor),
        finished,
        helpLevel: finished ? HELP[score]! : null,
        score: finished ? score : null,
        mood: finished ? (dose.moods[moodIndex++] ?? 4) : null,
        tryPassed: isTry && finished ? easy(score) : null,
      };
    };
    const days = dose.practice.map((score, i) => day(i + 1, score, false));
    if (dose.tryScore !== undefined) days.push(day(null, dose.tryScore, true));
    cursor.setDate(cursor.getDate() + 1); // a rest day between doses

    const finished = days.filter((d) => d.finished);
    const complete = dose.tryScore !== undefined;
    const tryPassed = easy(dose.tryScore);
    const passed = complete && dose.practice.filter(easy).length >= 4 && tryPassed;
    const average = (values: number[]) =>
      values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const run = (runs.get(dose.planId) ?? 0) + 1;
    runs.set(dose.planId, run);

    return {
      date: days[0]!.date,
      weekNumber: run,
      support: average(finished.map((d) => d.score!)),
      mood: average(finished.map((d) => d.mood!)),
      level: dose.level,
      planId: dose.planId,
      doseId: `sample-dose-${index}`,
      finishedCount: finished.length,
      kitSessionsLogged: days.filter((d) => !d.isTry).length,
      realLifeTryPassed: tryPassed,
      passed,
      complete,
      consultSuggested: dose.scenario === "consult",
      scenario: dose.scenario,
      days,
    };
  });
}
