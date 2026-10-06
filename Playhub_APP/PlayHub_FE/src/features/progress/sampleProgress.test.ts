import { describe, expect, test } from "bun:test";
import { sampleProgressPoints } from "./sampleProgress";

describe("home page sample progress", () => {
  test("follows the pass rule and ends with a dose still in progress", () => {
    const points = sampleProgressPoints(new Date(2026, 9, 6));
    expect(points.map((p) => p.passed)).toEqual([true, false, true, true, true, false, false]);
    expect(points.at(-1)?.complete).toBe(false);
    expect(points.at(-1)?.days.at(-1)?.date).toBe("2026-10-05");
    expect(points.every((p) => p.days.every((d) => d.finished === (d.score !== null)))).toBe(true);
  });
});
