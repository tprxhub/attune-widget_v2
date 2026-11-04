import type { PlanDuration, Subscription } from "@/lib/types";
import { apiRequest, getApiChildren, type ApiSubscription } from "./client";
import { mapSubscription } from "./mappers";

/** What a paid plan unlocks for a child; shown on the Subscription page and the home page. */
export const PLAN_FEATURES = [
  "All five Activities, the Real Life Try and Level-Up Prompt",
  "Every activity video, unblurred",
  "Unlimited Session logging — nothing overwritten",
  "Log Sessions for past dates too",
  "Full Progress chart and status",
  "Invite a Moderator",
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
  if (!child) throw new Error("Member not found");
  return mapSubscription(child);
}

export async function getSubscriptions(childIds: string[]): Promise<Subscription[]> {
  const wanted = new Set(childIds);
  return (await getApiChildren()).filter((child) => wanted.has(child.id)).map(mapSubscription);
}

function subscriptionFromResponse(childId: string, sub: ApiSubscription): Subscription {
  return {
    childId,
    status: sub.status === "active" ? "active" : sub.status === "expired" ? "expired" : "free",
    duration: (sub.plan_name as PlanDuration | null) ?? null,
    startedAt: sub.started_on,
    expiresAt: sub.ends_on,
    refundWindowEndsAt: sub.refundable_until,
    renewalOpen: !!sub.renewal_open,
    priceLabel: sub.plan_name?.replace(/^(\d+)m$/, "$1-Month") ?? null,
  };
}

/** Starts hosted Stripe Checkout. Only the signed Stripe webhook grants access. */
/**
 * Starts hosted Stripe Checkout in `tab` (a new tab the click already opened, so the browser
 * doesn't block it). Without a usable tab it falls back to this page. Returns true when payment
 * continues in the new tab.
 */
export async function checkout(
  childId: string,
  duration: PlanDuration,
  discountCode?: string | null,
  tab?: Window | null,
): Promise<boolean> {
  const response = await apiRequest<{ checkout_url: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({
      child_id: childId,
      plan: duration,
      ...(discountCode ? { discount_code: discountCode } : {}),
    }),
  });
  if (tab && !tab.closed) {
    tab.location.href = response.checkout_url;
    return true;
  }
  window.location.assign(response.checkout_url);
  return false;
}

/** Opens an empty tab straight from a click, for Stripe Checkout to load into once it's ready. */
export function openCheckoutTab(): Window | null {
  const tab = window.open("", "_blank");
  if (tab) {
    tab.opener = null; // the payment page can't reach back into Play Hub
    tab.document.title = "Opening secure payment…";
    tab.document.body.innerHTML =
      '<p style="font-family:system-ui,sans-serif;padding:2rem;color:#13295b">Opening secure payment…</p>';
  }
  return tab;
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
  end.setMonth(end.getMonth() + Number.parseInt(duration, 10));
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
