import { describe, expect, test } from "bun:test";
import type { Attempt } from "@/lib/types";
import { currentRound, roundSummary } from "./currentRound";

let n = 0;
const log = (entryId: string, date: string, extra: Partial<Attempt> = {}): Attempt =>
  ({
    id: `a${++n}`,
    entryId,
    date,
    createdAt: `${date}T10:00:${String(n).padStart(2, "0")}`,
    completionStatus: "finished",
    isRealLifeTry: false,
    mood: 4,
    ...extra,
  }) as Attempt;

describe("this week so far", () => {
  test("counts only the round since the last finished Real-Life Try", () => {
    const attempts = [
      ...["a1", "a2", "a3", "a4", "a5"].map((id, i) => log(id, `2026-09-0${i + 1}`)),
      log("try", "2026-09-06", { isRealLifeTry: true }),
      log("a1", "2026-09-10", { mood: 3 }),
      log("a1", "2026-09-11", { completionStatus: "stopped_early" }),
      log("a2", "2026-09-12", { mood: 5 }),
    ];
    expect(currentRound(attempts)).toHaveLength(3);
    expect(roundSummary(attempts)).toEqual({ activities: 2, finished: 2, recentMood: 5 });
  });

  test("never shows more than five activities, and is empty before the first log", () => {
    const many = Array.from({ length: 12 }, (_, i) => log(`x${i}`, "2026-09-01"));
    expect(roundSummary(many).activities).toBe(5);
    expect(roundSummary([])).toEqual({ activities: 0, finished: 0, recentMood: null });
  });
});
