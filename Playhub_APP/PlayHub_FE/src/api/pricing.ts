import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./client";
import { fmtMoney } from "@/lib/money";
import type { PlanDuration } from "@/lib/types";

export interface SubscriptionPricePlan {
  months: number;
  /** Amount in fils; AED 1 = 100 fils. */
  amount: number;
  label: string;
  note: string;
  featured: boolean;
  badge_text?: string;
}
export interface PricingCatalog {
  currency: "AED";
  plans: SubscriptionPricePlan[];
}
export const PRICING_QUERY_KEY = ["subscription-pricing"] as const;
export const DEFAULT_PRICING: PricingCatalog = {
  currency: "AED",
  plans: [
    {
      months: 1,
      amount: 6300,
      label: "1-Month",
      note: "A month of guided play to get started.",
      featured: false,
      badge_text: "Best value",
    },
    {
      months: 3,
      amount: 18900,
      label: "3-Month",
      note: "Trying the programme or a short-term goal.",
      featured: false,
      badge_text: "Best value",
    },
    {
      months: 6,
      amount: 33900,
      label: "6-Month",
      note: "A full development block across a term.",
      featured: true,
      badge_text: "Best value",
    },
  ],
};
export function loadPricing() {
  return apiRequest<PricingCatalog>("/billing/plans", { authenticated: false });
}
export function displayPricePlan(plan: SubscriptionPricePlan) {
  return {
    ...plan,
    duration: `${plan.months}m` as PlanDuration,
    price: fmtMoney(plan.amount / 100),
    per: `${fmtMoney(Math.round(plan.amount / plan.months) / 100)} / month`,
  };
}
export function usePricePlans() {
  const query = useQuery({ queryKey: PRICING_QUERY_KEY, queryFn: loadPricing, staleTime: 60_000 });
  return { ...query, plans: (query.data ?? DEFAULT_PRICING).plans.map(displayPricePlan) };
}
