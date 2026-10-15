import { expect, test } from "bun:test";
import { DEFAULT_PRICING, displayPricePlan } from "@/api/pricing";
import { pricingDraft, pricingDraftError, pricingFromDraft } from "./pricingDraft";

test("editable prices round trip without changing currency units", () => {
  expect(pricingFromDraft(pricingDraft(DEFAULT_PRICING))).toEqual(DEFAULT_PRICING);
  const draft = pricingDraft(DEFAULT_PRICING);
  draft[0]!.price = "29.99";
  draft[0]!.months = "2";
  const plan = pricingFromDraft(draft).plans[0]!;
  expect(plan.amount).toBe(2999);
  expect(displayPricePlan(plan)).toMatchObject({
    duration: "2m",
    price: "AED 29.99",
    per: "AED 15 / month",
  });
});

test("rejects extra plans, duplicate months, nonpositive and overly precise prices", () => {
  expect(pricingDraftError([])).not.toBeNull();
  expect(pricingDraftError(Array(6).fill(pricingDraft(DEFAULT_PRICING)[0]))).not.toBeNull();
  for (const patch of [
    { months: "3" },
    { months: "0" },
    { months: "1.5" },
    { price: "0" },
    { price: "1.234" },
    { price: "Infinity" },
    { label: " " },
  ]) {
    const draft = pricingDraft(DEFAULT_PRICING);
    Object.assign(draft[0]!, patch);
    expect(pricingDraftError(draft)).not.toBeNull();
    expect(() => pricingFromDraft(draft)).toThrow();
  }
});

test("custom badge text is saved and older plans receive the default", () => {
  const old = structuredClone(DEFAULT_PRICING);
  delete old.plans[0]!.badge_text;
  const draft = pricingDraft(old);
  expect(draft[0]!.badge_text).toBe("Best value");
  draft[0]!.badge_text = "  Most popular  ";
  expect(pricingFromDraft(draft).plans[0]!.badge_text).toBe("Most popular");
  draft[0]!.badge_text = "x".repeat(61);
  expect(pricingDraftError(draft)).not.toBeNull();
});
