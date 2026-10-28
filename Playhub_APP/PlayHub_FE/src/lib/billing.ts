/**
 * Organisation billing cycles. The API stores "monthly", "annual" or a custom period such as
 * "10_months"; the app works with the number of months in one cycle.
 */

export function cycleMonthsFromApi(cycle: string | null | undefined): number {
  if (cycle?.toLowerCase() === "monthly") return 1;
  const custom = cycle?.match(/^(\d+)_months$/);
  return custom ? Math.max(1, Number(custom[1])) : 12;
}

export function cycleToApi(months: number): string {
  return months === 1 ? "monthly" : months === 12 ? "annual" : `${months}_months`;
}

/** "Monthly", "Annual" or "10 months" (the Billing cycle choice). */
export function cycleLabel(months: number): string {
  return months === 1 ? "Monthly" : months === 12 ? "Annual" : `${months} months`;
}

/** "month", "year" or "10 months" (as in "AED 1,875 per 10 months"). */
export function cycleUnit(months: number): string {
  return months === 1 ? "month" : months === 12 ? "year" : `${months} months`;
}

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Today plus a number of months, as yyyy-mm-dd (the date input's format). */
export function monthsFromToday(months: number, today = new Date()): string {
  const date = new Date(today.getFullYear(), today.getMonth() + months, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(today.getDate(), lastDay));
  return isoDate(date);
}

/** Whole months from today to a yyyy-mm-dd date, to the nearest month; null for past dates. */
export function monthsUntil(value: string, today = new Date()): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  let months = (year - today.getFullYear()) * 12 + (month - 1 - today.getMonth());
  const dayGap = day - today.getDate();
  if (dayGap > 15) months += 1;
  if (dayGap < -15) months -= 1;
  return months >= 1 ? months : null;
}

/** The last day of a billing period, as yyyy-mm-dd: 1 January for 4 months ends on 30 April. */
export function periodEnd(start: string, months: number): string {
  const match = start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !Number.isInteger(months) || months < 1) return "";
  const from = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const end = new Date(from.getFullYear(), from.getMonth() + months, 1);
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(from.getDate(), lastDay) - 1);
  return isoDate(end);
}
