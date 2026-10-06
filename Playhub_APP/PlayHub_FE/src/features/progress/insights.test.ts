import { describe, expect, test } from "bun:test";
import type { InsightScenario, Level, ProgressDay, ProgressPoint } from "@/lib/types";
import { dosesPassed, insightFor } from "./insights";

const day = (
  n: number | "try",
  score: number | null,
  mood = 4,
  tryPassed = false,
): ProgressDay => ({
  day: n === "try" ? null : n,
  isTry: n === "try",
  date: "2026-07-01",
  finished: score !== null,
  helpLevel: null,
  score,
  mood: score === null ? null : mood,
  tryPassed: n === "try" && score !== null ? tryPassed : null,
});

function dose(
  level: Level,
  scores: Array<number | null>,
  tryScore: number | null,
  passed: boolean,
  scenario: InsightScenario | null = tryScore === null ? null : "first",
): ProgressPoint {
  const days = [
    ...scores.map((s, i) => day(i + 1, s)),
    ...(tryScore === null ? [] : [day("try", tryScore, 4, tryScore <= 33)]),
  ];
  return {
    date: "2026-07-01",
    weekNumber: 1,
    support: 0,
    mood: 4,
    level,
    planId: "p",
    doseId: level,
    finishedCount: 5,
    kitSessionsLogged: 5,
    realLifeTryPassed: tryScore !== null && tryScore <= 33,
    passed,
    complete: tryScore !== null,
    consultSuggested: false,
    scenario,
    days,
  };
}

describe("play progress insights", () => {
  test("a first dose fills level, effort, try result and mood into the fixed copy", () => {
    const insight = insightFor([dose("Starter", [100, 67, 67, 33, 67], 67, false)], 0);
    expect(insight?.title).toBe("First dose at this level");
    expect(insight?.seeing).toContain("first completed dose at Starter");
    expect(insight?.seeing).toContain("a lot of support");
    expect(insight?.seeing).toContain("they didn’t quite pass");
    expect(insight?.next).toContain("Let’s redo this level together");
  });

  test("each scenario uses its own template, and a pass changes What's next", () => {
    const passedSettling = dose("Pro", [33, 0, 33, 0, 0], 0, true, "settling");
    expect(insightFor([passedSettling], 0)?.next).toContain("already moving up");
    const consult = dose("Starter", [100, 67, 67, 67, 67], 67, false, "consult");
    expect(insightFor([consult], 0)?.title).toBe("Book a Play Consult");
    const progressing = dose("Starter", [100, 67, 33, 33, 33], 33, false, "progressing");
    expect(insightFor([progressing], 0)?.next).toContain("fast track");
  });

  test("a dose still in progress has no insight, and the tally counts completed doses only", () => {
    const doses = [
      dose("Starter", [33, 33, 0, 0, 0], 0, true),
      dose("Starter", [33, null, null, null, null], null, false),
    ];
    expect(insightFor(doses, 1)).toBeNull();
    expect(dosesPassed(doses)).toEqual({ passed: 1, total: 1 });
  });
});
