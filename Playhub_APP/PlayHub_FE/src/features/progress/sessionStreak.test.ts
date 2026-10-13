import { expect, test } from "bun:test";
import { sessionDayStreak } from "./sessionStreak";
const today = new Date(2026, 9, 13, 12);
const rows = (...dates: string[]) => dates.map((date) => ({ date }));
test("daily streak counts days once and accepts yesterday's continuing streak", () => {
  expect(sessionDayStreak(rows("2026-10-12", "2026-10-11", "2026-10-12"), today)).toBe(2);
  expect(sessionDayStreak(rows("2026-10-13", "2026-10-11", "2026-10-12"), today)).toBe(3);
});
test("a missing day breaks a streak and future logs cannot start one", () => {
  expect(sessionDayStreak(rows("2026-10-11", "2026-10-10"), today)).toBe(0);
  expect(sessionDayStreak(rows("2026-10-13", "2026-10-11"), today)).toBe(1);
  expect(sessionDayStreak(rows("2026-10-14"), today)).toBe(0);
});
