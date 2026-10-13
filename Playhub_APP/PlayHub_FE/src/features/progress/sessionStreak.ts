import type { Attempt } from "@/lib/types";

/** Consecutive logged calendar days, ending today or yesterday; repeated Sessions count once. */
export function sessionDayStreak(rows: ReadonlyArray<Pick<Attempt, "date">>, today = new Date()) {
  const dayMs = 86400000;
  const days = new Set(rows.map((row) => Math.floor(Date.parse(`${row.date}T00:00:00Z`) / dayMs)));
  let cursor = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / dayMs;
  if (!days.has(cursor)) cursor -= 1;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}
