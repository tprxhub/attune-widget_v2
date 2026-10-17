import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
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
/**
 * Route loader for pages that show prices: fetch the saved catalogue before the page renders, so
 * the built-in default prices never flash. A slow or failing API falls back to them after 3s.
 */
export async function loadPricingForRoute(
  queryClient: QueryClient,
): Promise<{ pricing: PricingCatalog | null }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const pricing = await Promise.race([
      queryClient.ensureQueryData({ queryKey: PRICING_QUERY_KEY, queryFn: loadPricing }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 3000);
      }),
    ]);
    return { pricing };
  } catch {
    return { pricing: null };
  } finally {
    clearTimeout(timer);
  }
}

function loadedPricing(loaderData: unknown): PricingCatalog | undefined {
  if (loaderData && typeof loaderData === "object" && "pricing" in loaderData) {
    return (loaderData as { pricing: PricingCatalog | null }).pricing ?? undefined;
  }
  return undefined;
}

export function usePricePlans() {
  const initial = useRouterState({
    select: (state) => state.matches.map((match) => loadedPricing(match.loaderData)).find(Boolean),
  });
  const query = useQuery({
    queryKey: PRICING_QUERY_KEY,
    queryFn: loadPricing,
    staleTime: 60_000,
    ...(initial ? { initialData: initial } : {}),
  });
  return { ...query, plans: (query.data ?? DEFAULT_PRICING).plans.map(displayPricePlan) };
}
