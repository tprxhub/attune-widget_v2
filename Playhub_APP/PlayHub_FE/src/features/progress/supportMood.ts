import { fmtShortDate } from "@/lib/format";
import type { Attempt } from "@/lib/types";

/** Mood 1–5 colours, from "really struggled" (coral) to "loved it" (green). */
export const MOOD_COLORS = ["#DF3B2D", "#F08A3C", "#A89A8C", "#F2B544", "#6FA05A"] as const;
export const moodColor = (mood: number) => MOOD_COLORS[Math.min(5, Math.max(1, mood)) - 1]!;
/** The unfilled part of each ring blends into the white card. */
export const TRACK = "#FFFFFF";
/** Stand-in for the face before any mood is logged. */
export const EMPTY_FACE = "#ECEEF2";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
export const day = (date: string) => new Date(`${date}T00:00:00`);

export interface MoodDay {
  date: string;
  mood: number;
  weekday: string;
}

/** One mood per day (that day's latest Session) for the last seven days with a Session, oldest first. */
export function recentMoods(rows: Attempt[], count = 7): MoodDay[] {
  const byDay = new Map<string, number>();
  [...rows]
    .filter((row) => row.mood >= 1)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .forEach((row) => byDay.set(row.date, row.mood));
  return [...byDay]
    .slice(-count)
    .map(([date, mood]) => ({ date, mood, weekday: WEEKDAY.format(day(date)) }));
}

export const averageMood = (moods: MoodDay[]) =>
  moods.length ? moods.reduce((sum, m) => sum + m.mood, 0) / moods.length : null;

export const moodRange = (moods: MoodDay[]) =>
  moods.length ? `${fmtShortDate(moods[0]!.date)} – ${fmtShortDate(moods.at(-1)!.date)}` : "";

/** The outer ring fills as less help is needed, like the charts where up means more independent. */
export const independence = (supportScore: number | null) =>
  supportScore === null ? 0 : (100 - supportScore) / 100;

export interface Celebration {
  headline: string;
  message: string;
  /** Short wins shown as chips, best first. */
  wins: string[];
}

/** A cheerful, truthful headline for the child's week, from their Support Score and moods. */
export function celebrate(
  name: string,
  supportScore: number | null,
  moods: MoodDay[],
): Celebration {
  const average = averageMood(moods);
  const happyDays = moods.filter((m) => m.mood >= 4).length;
  const independent = supportScore !== null && supportScore <= 33;
  const wins: string[] = [];
  if (happyDays) wins.push(`${happyDays} happy day${happyDays === 1 ? "" : "s"}`);
  if (independent) wins.push(supportScore === 0 ? "Did it solo" : "Needing less help");
  if (moods.length) wins.push(`${moods.length} day${moods.length === 1 ? "" : "s"} of play`);

  if (!moods.length && supportScore === null) {
    return {
      headline: `${name}’s first win is coming`,
      message: "Log a Session to start the story.",
      wins,
    };
  }
  if (independent && average !== null && average >= 4) {
    return { headline: `${name} is flying!`, message: "Less help needed, and loving it.", wins };
  }
  if (independent) {
    return {
      headline: "Growing more independent",
      message: `${name} is needing less help each day.`,
      wins,
    };
  }
  if (average !== null && average >= 4) {
    return { headline: "Happy hands at play", message: `${name} is enjoying every Session.`, wins };
  }
  return {
    headline: "Every Session counts",
    message: `Small steps, big progress. Keep going, ${name}!`,
    wins,
  };
}
