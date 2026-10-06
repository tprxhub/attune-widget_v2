import type { PlanDuration } from "@/lib/types";

/**
 * Play Hub charges in UAE dirhams. These must match PLAN_CATALOG in the backend
 * (app/billing.py), which holds the same prices in fils.
 */
export const CURRENCY = "AED";

export const PLAN_PRICES: Record<PlanDuration, { amount: number; months: number }> = {
  "3m": { amount: 189, months: 3 },
  "6m": { amount: 339, months: 6 },
  "12m": { amount: 579, months: 12 },
};

/** "AED 189", "AED 56.50" — whole amounts drop the decimals. */
export function fmtMoney(amount: number): string {
  const fixed = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${CURRENCY} ${fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** "AED 189" for a plan, or null when the plan is unknown. */
export function planPriceLabel(duration: string | null | undefined): string | null {
  const plan = duration ? PLAN_PRICES[duration as PlanDuration] : undefined;
  return plan ? fmtMoney(plan.amount) : null;
}

/** "AED 63 / month" */
export function perMonthLabel(duration: PlanDuration): string {
  const plan = PLAN_PRICES[duration];
  return `${fmtMoney(Math.round((plan.amount / plan.months) * 100) / 100)} / month`;
}
