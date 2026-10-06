import type { InsightScenario, Level, ProgressPoint } from "@/lib/types";

/**
 * Play Progress insight copy (the "Insight Templates" doc). Which scenario applies is decided by
 * the API (Logic Spec, first match wins) and arrives on each completed dose as `scenario`; this
 * file only fills in the fixed wording. Nothing here is generated free-form.
 */

export type Scenario = InsightScenario;

export interface Insight {
  scenario: Scenario;
  title: string;
  seeing: string;
  next: string;
}

/** Practice days 1-5, in order; a day that was not logged is undefined. */
export const practiceDays = (dose: ProgressPoint) => {
  const byDay = new Map<number, ProgressPoint["days"][number]>();
  for (const day of dose.days) if (!day.isTry && day.day !== null) byDay.set(day.day, day);
  return [1, 2, 3, 4, 5].map((n) => byDay.get(n));
};

export const tryDay = (dose: ProgressPoint) => dose.days.find((day) => day.isTry);

/** A dose is a pass or a redo only once it is complete; before that it has no verdict. */
export const doseVerdict = (dose: ProgressPoint): "passed" | "redo" | "in-progress" =>
  !dose.complete ? "in-progress" : dose.passed ? "passed" : "redo";

const effortWord = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "some";
  if (score <= 16) return "very little";
  if (score <= 50) return "a little";
  if (score <= 83) return "a fair amount of";
  return "a lot of";
};

const moodWord = (dose: ProgressPoint) => {
  const moods = dose.days.filter((day) => day.finished && day.mood).map((day) => day.mood!);
  const average = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 3;
  if (average >= 4) return "happy or content";
  if (average >= 2.8) return "sometimes happy, sometimes not";
  return "not happy";
};

const LEVEL_NAME: Record<Level, string> = { Rookie: "Rookie", Starter: "Starter", Pro: "Pro" };

/** The Insight card for one complete dose; null while the dose is still in progress. */
export function insightFor(doses: ProgressPoint[], index: number): Insight | null {
  const dose = doses[index];
  if (!dose || !dose.complete || !dose.scenario) return null;
  const scenario = dose.scenario;
  const level = LEVEL_NAME[dose.level];
  const mood = moodWord(dose);
  const tryPassed = dose.realLifeTryPassed;
  const passed = dose.passed;
  const firstFinished = dose.days.find((day) => day.finished);
  const tryWords = (yes: string, no: string) => (tryPassed ? yes : no);

  switch (scenario) {
    case "first":
      return {
        scenario,
        title: "First dose at this level",
        seeing: `This is your child’s first completed dose at ${level}. They needed ${effortWord(firstFinished?.score)} support on the dose days, and ${tryWords("they passed", "they didn’t quite pass")} the Real-Life Try. Through it all, they seemed ${mood}.`,
        next:
          tryPassed && passed
            ? "Wonderful progress — your child is ready to move up to the next level."
            : tryPassed
              ? "The Real-Life Try went well, even though the dose days weren’t quite enough on their own. Let’s redo this level with fast track on, to build on what’s already working. And if you’d ever like a bit of extra support along the way, a Play Consult is always there for you — whenever it feels right, not just when things get hard."
              : "Let’s redo this level together — a little more practice here will make a real difference. If you’d like some extra support at any point, booking a Play Consult is always an option, entirely up to you.",
      };
    case "progressing":
      return {
        scenario,
        title: "Progressing",
        seeing: `Your child is needing less support than they did on the first day of this dose — real progress. ${tryWords("They passed", "They didn’t quite pass")} the Real-Life Try, and seemed ${mood} along the way.`,
        next: passed
          ? "Great work — your child is ready to move up to the next level."
          : "So close. Let’s redo this level with fast track on to help it click. And remember, a Play Consult is always available too, whenever you’d like a little extra support.",
      };
    case "steady":
      return {
        scenario,
        title: "Holding steady",
        seeing: `Your child is needing about the same amount of support as they did on the first day of this dose. They seemed ${mood} throughout.`,
        next: "Let’s give it one more dose. If things stay the same, it may be worth booking a Play Consult to look at this together.",
      };
    case "settling":
      return {
        scenario,
        title: "Settling in",
        seeing: `Your child has just moved up to ${level} — a new level, so it’s completely natural that they’re needing a bit more support than they did on the last day of the level before. They seemed ${mood} while settling in.`,
        next: passed
          ? "A strong week — your child is already moving up to the next level."
          : "Let’s give it the next dose. Support should ease as they settle into this new level. If you’d ever like extra support along the way, a Play Consult is always there — no need to wait until things feel stuck.",
      };
    case "consult":
      return {
        scenario,
        title: "Book a Play Consult",
        seeing: `Your child is needing more support than they did on the first day of this dose, and the Real-Life Try hasn’t been passed for two doses in a row now. Through it, they seemed ${mood}.`,
        next: "It’s a good time to book a Play Consult, so we can look at this together and find the right next step.",
      };
  }
}

/** Plain tally for the Play Plan card: completed doses that passed, out of completed doses. */
export function dosesPassed(doses: ProgressPoint[]) {
  const completed = doses.filter((dose) => dose.complete);
  return { passed: completed.filter((dose) => dose.passed).length, total: completed.length };
}

export const lastCompleteIndex = (doses: ProgressPoint[]) => {
  for (let i = doses.length - 1; i >= 0; i -= 1) if (doses[i]!.complete) return i;
  return -1;
};
