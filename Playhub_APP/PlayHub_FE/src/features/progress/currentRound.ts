import type { Attempt } from "@/lib/types";

/**
 * The sessions of the round in progress for one Play Dose: everything logged since the last
 * finished Real-Life Try. A finished Try closes a round, so logging again is a redo (the same
 * rule the API uses for Progress).
 */
export function currentRound(attempts: Attempt[]): Attempt[] {
  const ordered = [...attempts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  let start = 0;
  ordered.forEach((attempt, index) => {
    if (attempt.isRealLifeTry && attempt.completionStatus === "finished") start = index + 1;
  });
  return ordered.slice(start);
}

/** "This week so far": activities done out of five, how many were finished, the latest mood. */
export function roundSummary(attempts: Attempt[]) {
  const round = currentRound(attempts);
  const practice = round.filter((attempt) => !attempt.isRealLifeTry);
  return {
    activities: Math.min(5, new Set(practice.map((attempt) => attempt.entryId)).size),
    finished: Math.min(5, practice.filter((a) => a.completionStatus === "finished").length),
    recentMood: round.at(-1)?.mood ?? null,
  };
}
