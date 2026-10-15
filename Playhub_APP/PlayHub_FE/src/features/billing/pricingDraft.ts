import type { PricingCatalog, SubscriptionPricePlan } from "@/api/pricing";

export interface PriceDraft extends Omit<SubscriptionPricePlan, "amount" | "months"> {
  months: string;
  price: string;
}
export function pricingDraft(catalog: PricingCatalog): PriceDraft[] {
  return catalog.plans.map(({ amount, months, ...plan }) => ({
    ...plan,
    badge_text: plan.badge_text ?? "Best value",
    months: String(months),
    price: String(amount / 100),
  }));
}
function validPricingLabel(value: string | undefined, limit: number): boolean {
  const length = value?.trim().length ?? 0;
  return length > 0 && length <= limit;
}

/** Accept AED totals with no more than two decimal places. */
function validPricingAmount(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 1 && Number(value) <= 1_000_000;
}

export function pricingDraftError(plans: PriceDraft[]): string | null {
  if (plans.length < 1 || plans.length > 5) return "Add between 1 and 5 subscription plans.";
  for (const plan of plans) {
    if (!/^\d+$/.test(plan.months) || Number(plan.months) < 1 || Number(plan.months) > 60)
      return "Each duration must be a whole number between 1 and 60 months.";
    if (!validPricingAmount(plan.price))
      return "Each price must be between AED 1 and AED 1,000,000, with at most two decimal places.";
    if (!validPricingLabel(plan.label, 80)) return "Each plan needs a name of up to 80 characters.";
    if (!validPricingLabel(plan.badge_text, 60))
      return "Each badge needs text of up to 60 characters.";
    if (plan.note.trim().length > 600) return "Keep each description within 600 characters.";
  }
  if (new Set(plans.map((plan) => Number(plan.months))).size !== plans.length)
    return "Give each plan a different month duration.";
  return null;
}
export function pricingFromDraft(plans: PriceDraft[]): PricingCatalog {
  const error = pricingDraftError(plans);
  if (error) throw new Error(error);
  return {
    currency: "AED",
    plans: plans.map(({ months, price, ...plan }) => ({
      ...plan,
      label: plan.label.trim(),
      badge_text: plan.badge_text!.trim(),
      note: plan.note.trim(),
      months: Number(months),
      amount: Math.round(Number(price) * 100),
    })),
  };
}
