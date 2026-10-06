import type { PlanDuration, Subscription } from "@/lib/types";
import { apiRequest, getApiChildren, type ApiSubscription } from "./client";
import { mapSubscription } from "./mappers";
import { perMonthLabel, planPriceLabel } from "@/lib/money";

/** What a paid plan unlocks for a child; shown on the Subscription page and the home page. */
export const PLAN_FEATURES = [
  "All five Activities, the Real Life Try and Level-Up Prompt",
  "Every activity video, unblurred",
  "Unlimited Session logging — nothing overwritten",
  "Log Sessions for past dates too",
  "Full Progress chart and status",
  "Invite a Moderator",
];

export const PRICE_PLANS: {
  duration: PlanDuration;
  label: string;
  price: string;
  per: string;
  note: string;
}[] = [
  {
    duration: "3m",
    label: "3-Month",
    price: planPriceLabel("3m")!,
    per: perMonthLabel("3m"),
    note: "Trying the programme or a short-term goal.",
  },
  {
    duration: "6m",
    label: "6-Month",
    price: planPriceLabel("6m")!,
    per: perMonthLabel("6m"),
    note: "A full development block across a term.",
  },
  {
    duration: "12m",
    label: "12-Month",
    price: planPriceLabel("12m")!,
    per: perMonthLabel("12m"),
    note: "Best value for an ongoing programme.",
  },
];

/** Matches RENEWAL_WINDOW_DAYS on the server: renewing opens this many days before the last day. */
export const RENEWAL_WINDOW_DAYS = 14;

export type SubscriptionStage = "free" | "active" | "ending" | "ended";

/**
 * Where a family subscription stands today. `lastDay` is the last day of access (inclusive);
 * `daysLeft` counts the days after today, so 0 means today is the last day.
 */
export function subscriptionStage(
  sub: Subscription | undefined | null,
  today = new Date(),
): {
  stage: SubscriptionStage;
  lastDay: string | null;
  daysLeft: number | null;
} {
  const lastDay = sub?.expiresAt ?? null;
  if (!sub || !lastDay || (sub.status === "free" && !sub.startedAt)) {
    return { stage: sub?.status === "active" ? "active" : "free", lastDay: null, daysLeft: null };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = lastDay.slice(0, 10).split("-").map(Number);
  const daysLeft = Math.round((new Date(y!, m! - 1, d!).getTime() - start.getTime()) / 86_400_000);
  if (daysLeft < 0 || sub.status !== "active") return { stage: "ended", lastDay, daysLeft };
  return { stage: daysLeft <= RENEWAL_WINDOW_DAYS ? "ending" : "active", lastDay, daysLeft };
}

/** "today", "tomorrow", "in 6 days". */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "today";
  return daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
}

export async function getSubscription(childId: string): Promise<Subscription> {
  const child = (await getApiChildren()).find((item) => item.id === childId);
  if (!child) throw new Error("Child not found");
  return mapSubscription(child);
}

export async function getSubscriptions(childIds: string[]): Promise<Subscription[]> {
  const wanted = new Set(childIds);
  return (await getApiChildren()).filter((child) => wanted.has(child.id)).map(mapSubscription);
}

const monthsFor: Record<PlanDuration, number> = { "3m": 3, "6m": 6, "12m": 12 };

function subscriptionFromResponse(childId: string, sub: ApiSubscription): Subscription {
  return {
    childId,
    status: sub.status === "active" ? "active" : sub.status === "expired" ? "expired" : "free",
    duration: (sub.plan_name as PlanDuration | null) ?? null,
    startedAt: sub.started_on,
    expiresAt: sub.ends_on,
    refundWindowEndsAt: sub.refundable_until,
    renewalOpen: !!sub.renewal_open,
    priceLabel: planPriceLabel(sub.plan_name) ?? sub.plan_name,
  };
}

/** Starts hosted Stripe Checkout. Only the signed Stripe webhook grants access. */
export async function checkout(childId: string, duration: PlanDuration): Promise<void> {
  const response = await apiRequest<{ checkout_url: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ child_id: childId, plan: duration }),
  });
  window.location.assign(response.checkout_url);
}

export async function refundSubscription(childId: string): Promise<Subscription> {
  const sub = await apiRequest<ApiSubscription>(`/billing/refund/${childId}`, { method: "POST" });
  return subscriptionFromResponse(childId, sub);
}

/** Manual platform-admin grant used from the administration panel. */
export async function adminActivateSubscription(
  childId: string,
  duration: PlanDuration,
): Promise<Subscription> {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + monthsFor[duration]);
  const sub = await apiRequest<ApiSubscription>(`/children/${childId}/subscription`, {
    method: "PUT",
    body: JSON.stringify({
      status: "active",
      plan_name: duration,
      started_on: start.toISOString().slice(0, 10),
      ends_on: end.toISOString().slice(0, 10),
    }),
  });
  return subscriptionFromResponse(childId, sub);
}

export async function adminCancelSubscription(childId: string) {
  const sub = await apiRequest<ApiSubscription>(`/children/${childId}/subscription`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled", plan_name: null, started_on: null, ends_on: null }),
  });
  return subscriptionFromResponse(childId, sub);
}

export async function allSubscriptions() {
  return (await getApiChildren()).map(mapSubscription);
}
