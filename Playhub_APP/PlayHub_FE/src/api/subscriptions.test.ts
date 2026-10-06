import { describe, expect, test } from "bun:test";
import type { Subscription } from "@/lib/types";
import { daysLeftLabel, subscriptionStage } from "./subscriptions";

const today = new Date(2026, 9, 6);
const sub = (status: Subscription["status"], expiresAt: string | null): Subscription => ({
  childId: "c",
  status,
  duration: "6m",
  startedAt: "2026-04-06",
  expiresAt,
  refundWindowEndsAt: null,
  priceLabel: "AED 339",
  renewalOpen: false,
});

describe("subscription stage", () => {
  test("active, ending in the last 14 days, ended, and free", () => {
    expect(subscriptionStage(sub("active", "2026-12-01"), today).stage).toBe("active");
    expect(subscriptionStage(sub("active", "2026-10-20"), today)).toEqual({
      stage: "ending",
      lastDay: "2026-10-20",
      daysLeft: 14,
    });
    expect(subscriptionStage(sub("active", "2026-10-06"), today).daysLeft).toBe(0);
    expect(subscriptionStage(sub("expired", "2026-10-01"), today).stage).toBe("ended");
    expect(subscriptionStage(sub("free", null), today).stage).toBe("free");
    expect(subscriptionStage(undefined, today).stage).toBe("free");
  });

  test("days left reads naturally", () => {
    expect([0, 1, 6].map(daysLeftLabel)).toEqual(["today", "tomorrow", "in 6 days"]);
  });
});
