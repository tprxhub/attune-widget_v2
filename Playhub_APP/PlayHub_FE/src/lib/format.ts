/**
 * Dates are always written as "8th Oct, 2026" so they read the same in every country:
 * numeric dates like 08/10/2026 mean different days in different places.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd, 23rd … */
export function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${{ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th"}`;
}

/** Accepts "2026-10-08" (a calendar day, read as local) or a full ISO timestamp. */
function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const month = (date: Date) => MONTHS[date.getMonth()]!.slice(0, 3);

/** "8th Oct, 2026" */
export function fmtDate(value: string | Date): string {
  const date = toDate(value);
  if (!date) return "";
  return `${ordinal(date.getDate())} ${month(date)}, ${date.getFullYear()}`;
}

/** "8th Oct" (when the year is already clear from context). */
export function fmtDayMonth(value: string | Date): string {
  const date = toDate(value);
  return date ? `${ordinal(date.getDate())} ${month(date)}` : "";
}

/** "8th Oct", for chart labels where space is tight. */
export const fmtShortDate = fmtDayMonth;

/** "12:10" (24-hour). */
export function fmtTime(value: string | Date, withSeconds = false): string {
  const date = toDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return withSeconds ? `${time}:${pad(date.getSeconds())}` : time;
}

/** "13th Oct, 2026 at 12:10" */
export function fmtDateTime(value: string | Date, withSeconds = false): string {
  const date = toDate(value);
  return date ? `${fmtDate(date)} at ${fmtTime(date, withSeconds)}` : "";
}

/** "Tuesday, 8th Oct, 2026" */
export function fmtLongDate(value: string | Date): string {
  const date = toDate(value);
  if (!date) return "";
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  return `${weekday}, ${fmtDate(date)}`;
}

/**
 * "18th – 23rd Sep, 2026", "28th Sep – 4th Oct, 2026", or a single date when
 * both ends are the same day.
 */
export function fmtDateRange(start: string | Date, end: string | Date): string {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return fmtDate(a ?? b ?? "");
  if (a.toDateString() === b.toDateString()) return fmtDate(a);
  if (a.getFullYear() !== b.getFullYear()) return `${fmtDate(a)} – ${fmtDate(b)}`;
  if (a.getMonth() !== b.getMonth()) return `${fmtDayMonth(a)} – ${fmtDate(b)}`;
  return `${ordinal(a.getDate())} – ${fmtDate(b)}`;
}
