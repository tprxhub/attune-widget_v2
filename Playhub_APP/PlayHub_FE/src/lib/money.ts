/**
 * Play Hub charges in UAE dirhams. Subscription prices come only from the saved catalogue
 * (/billing/plans), which the Super Admin edits under Subscription pricing.
 */
export const CURRENCY = "AED";

/** "AED 189", "AED 56.50" — whole amounts drop the decimals. */
export function fmtMoney(amount: number): string {
  const fixed = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${CURRENCY} ${fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
