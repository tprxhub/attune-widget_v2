import type { Attempt, CompletionStatus, HelpLevel } from "@/lib/types";
import { apiRequest, type ApiAttempt } from "./client";
import { mapAttempt } from "./mappers";
import { listPlans } from "./plans";

export interface NewAttemptInput {
  childId: string;
  planId: string;
  entryId: string;
  date: string;
  completion: number;
  completionStatus: CompletionStatus;
  helpLevel: HelpLevel;
  mood: number;
  bigWin: string;
  consultNotes?: string;
  source: "play_dose" | "daily_check_in";
  loggedBy: string;
}

export async function listAttempts(childId: string): Promise<Attempt[]> {
  const [rows, plans] = await Promise.all([
    apiRequest<ApiAttempt[]>(`/children/${childId}/attempts`),
    listPlans(),
  ]);
  return rows
    .map((row) => mapAttempt(row, plans))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export async function listRecentAttempts(childIds: string[], limit = 8): Promise<Attempt[]> {
  const rows = (await Promise.all(childIds.map(listAttempts))).flat();
  return rows
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Attempts are append-only in the API; saving never overwrites a previous session. */
export async function logAttempt(input: NewAttemptInput): Promise<Attempt> {
  const plans = await listPlans();
  const row = await apiRequest<ApiAttempt>(`/children/${input.childId}/attempts`, {
    method: "POST",
    body: JSON.stringify({
      play_dose_id: input.planId,
      activity_id: input.entryId || null,
      occurred_on: input.date,
      completion_score: input.completion,
      completion_status: input.completionStatus,
      help_level: input.helpLevel,
      mood_score: input.mood,
      big_win: input.bigWin || null,
      notes: input.consultNotes || null,
      source: input.source,
    }),
  });
  return mapAttempt(row, plans);
}
