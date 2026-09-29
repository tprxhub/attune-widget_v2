import type { PlanDuration, Subscription } from "@/lib/types";
import { apiRequest, getApiChildren, type ApiSubscription } from "./client";
import { mapSubscription } from "./mappers";

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
    price: "£39",
    per: "£13 / month",
    note: "Trying the programme or a short-term goal.",
  },
  {
    duration: "6m",
    label: "6-Month",
    price: "£69",
    per: "£11.50 / month",
    note: "A full development block across a term.",
  },
  {
    duration: "12m",
    label: "12-Month",
    price: "£119",
    per: "£9.92 / month",
    note: "Best value for an ongoing programme.",
  },
];

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
    priceLabel: PRICE_PLANS.find((item) => item.duration === sub.plan_name)?.price ?? sub.plan_name,
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
