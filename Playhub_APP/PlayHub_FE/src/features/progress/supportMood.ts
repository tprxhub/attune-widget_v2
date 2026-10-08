import { fmtShortDate } from "@/lib/format";
import type { Attempt } from "@/lib/types";

/** Mood 1–5 colours, from "really struggled" (coral) to "loved it" (green). */
export const MOOD_COLORS = ["#DF3B2D", "#F08A3C", "#A89A8C", "#F2B544", "#6FA05A"] as const;
export const moodColor = (mood: number) => MOOD_COLORS[Math.min(5, Math.max(1, mood)) - 1]!;
export const TRACK = "#E9E2DA";

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
