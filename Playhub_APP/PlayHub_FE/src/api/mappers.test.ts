import { expect, test } from "bun:test";
import type { ApiAttempt } from "./client";
import { mapAttempt } from "./mappers";

const row: ApiAttempt = {
  id: "session-1",
  child_id: "child-1",
  play_plan_id: "plan-1",
  play_dose_id: "dose-1",
  activity_id: null,
  occurred_on: "2026-10-06",
  completion_score: 4,
  completion_status: "finished",
  help_level: "one_reminder",
  is_real_life_try: false,
  week_number: 1,
  run_number: 1,
  mood_score: 4,
  big_win: "Happy today",
  notes: null,
  source: "daily_check_in",
  logged_by_id: "admin-1",
  logged_by_name: "Admin",
  created_at: "2026-10-06T12:00:00Z",
};

test("session corrections preserve missing and saved activity IDs", () => {
  const legacy = mapAttempt(row, []);
  expect(legacy.planId).toBe("dose-1");
  expect(legacy.entryId || null).toBeNull();
  const linked = mapAttempt({ ...row, activity_id: "activity-1" }, []);
  expect(linked.entryId).toBe("activity-1");
});
