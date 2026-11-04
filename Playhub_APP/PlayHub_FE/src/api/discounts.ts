import { apiRequest } from "./client";

/** Money from the API is in fils (AED 1 = 100 fils). */

export interface Offer {
  code: string;
  title: string;
  description: string | null;
  kind: "percent" | "amount";
  value: number;
  maxDiscount: number | null;
  /** Month durations it applies to; empty means every plan. */
  plans: number[];
  endsOn: string | null;
  newCustomersOnly: boolean;
}

export interface DiscountQuote {
  code: string;
  title: string;
  listAmount: number;
  discountAmount: number;
  finalAmount: number;
}

export type DiscountStatus = "active" | "scheduled" | "ended" | "used_up" | "paused";

export interface Discount extends Offer {
  id: string;
  maxUses: number | null;
  startsOn: string | null;
  oncePerAccount: boolean;
  showInOffers: boolean;
  isActive: boolean;
  createdAt: string;
  uses: number;
  totalSaved: number;
  status: DiscountStatus;
}

export interface DiscountInput {
  code: string;
  title: string;
  description: string;
  kind: "percent" | "amount";
  value: number;
  maxDiscount: number | null;
  plans: number[];
  startsOn: string | null;
  endsOn: string | null;
  maxUses: number | null;
  oncePerAccount: boolean;
  newCustomersOnly: boolean;
  showInOffers: boolean;
  isActive: boolean;
}

interface ApiOffer {
  code: string;
  title: string;
  description: string | null;
  kind: "percent" | "amount";
  value: number;
  max_discount: number | null;
  plans: number[];
  ends_on: string | null;
  new_customers_only: boolean;
}

interface ApiDiscount extends ApiOffer {
  id: string;
  max_uses: number | null;
  starts_on: string | null;
  once_per_account: boolean;
  show_in_offers: boolean;
  is_active: boolean;
  created_at: string;
  uses: number;
  total_saved: number;
  status: DiscountStatus;
}

const toOffer = (row: ApiOffer): Offer => ({
  code: row.code,
  title: row.title,
  description: row.description,
  kind: row.kind,
  value: row.value,
  maxDiscount: row.max_discount,
  plans: row.plans,
  endsOn: row.ends_on,
  newCustomersOnly: row.new_customers_only,
});

const toDiscount = (row: ApiDiscount): Discount => ({
  ...toOffer(row),
  id: row.id,
  maxUses: row.max_uses,
  startsOn: row.starts_on,
  oncePerAccount: row.once_per_account,
  showInOffers: row.show_in_offers,
  isActive: row.is_active,
  createdAt: row.created_at,
  uses: row.uses,
  totalSaved: row.total_saved,
  status: row.status,
});

const toBody = (input: DiscountInput) => ({
  code: input.code,
  title: input.title,
  description: input.description,
  kind: input.kind,
  value: input.value,
  max_discount: input.kind === "percent" ? input.maxDiscount : null,
  plans: input.plans,
  starts_on: input.startsOn || null,
  ends_on: input.endsOn || null,
  max_uses: input.maxUses,
  once_per_account: input.oncePerAccount,
  new_customers_only: input.newCustomersOnly,
  show_in_offers: input.showInOffers,
  is_active: input.isActive,
});

/** Stripe's smallest charge; a discount never takes a price below it (matches the server). */
export const MIN_CHARGE = 200;

/** What an offer would take off a price, in fils, for showing savings before checking the code. */
export function estimateSaving(offer: Offer, months: number, amount: number): number {
  if (offer.plans.length && !offer.plans.includes(months)) return 0;
  let off = offer.kind === "percent" ? Math.round((amount * offer.value) / 100) : offer.value;
  if (offer.kind === "percent" && offer.maxDiscount) off = Math.min(off, offer.maxDiscount);
  return Math.max(0, Math.min(off, amount - MIN_CHARGE));
}

/** "20% off", "AED 50 off", "20% off up to AED 60". */
export function offerHeadline(offer: Pick<Offer, "kind" | "value" | "maxDiscount">): string {
  const aed = (fils: number) =>
    `AED ${Number.isInteger(fils / 100) ? fils / 100 : (fils / 100).toFixed(2)}`;
  if (offer.kind === "amount") return `${aed(offer.value)} off`;
  return offer.maxDiscount
    ? `${offer.value}% off up to ${aed(offer.maxDiscount)}`
    : `${offer.value}% off`;
}

export const OFFERS_KEY = ["billing", "offers"] as const;
export const DISCOUNTS_KEY = ["billing", "discounts"] as const;

export async function listOffers() {
  return (await apiRequest<ApiOffer[]>("/billing/offers")).map(toOffer);
}

export async function checkDiscount(code: string, plan: string): Promise<DiscountQuote> {
  const row = await apiRequest<{
    code: string;
    title: string;
    list_amount: number;
    discount_amount: number;
    final_amount: number;
  }>("/billing/discounts/check", { method: "POST", body: JSON.stringify({ code, plan }) });
  return {
    code: row.code,
    title: row.title,
    listAmount: row.list_amount,
    discountAmount: row.discount_amount,
    finalAmount: row.final_amount,
  };
}

export async function listDiscounts() {
  return (await apiRequest<ApiDiscount[]>("/billing/discounts")).map(toDiscount);
}

export async function createDiscount(input: DiscountInput) {
  return toDiscount(
    await apiRequest<ApiDiscount>("/billing/discounts", {
      method: "POST",
      body: JSON.stringify(toBody(input)),
    }),
  );
}

export async function updateDiscount(id: string, input: DiscountInput) {
  return toDiscount(
    await apiRequest<ApiDiscount>(`/billing/discounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(toBody(input)),
    }),
  );
}

export async function deleteDiscount(id: string) {
  await apiRequest<void>(`/billing/discounts/${id}`, { method: "DELETE" });
}
