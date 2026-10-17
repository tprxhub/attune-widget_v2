import { describe, expect, test } from "bun:test";
import { DEFAULT_HUB_CARDS, type HubCardSetting } from "./hubTiles";
import { moveHubCardToSlot } from "./moveHubCardToSlot";

const layout = (cards: HubCardSetting[]) =>
  cards
    .filter((card) => !card.hidden)
    .sort((a, b) => a.order - b.order)
    .map(({ id, width }) => [id, width]);

describe("moving Hub card contents between slots", () => {
  test("a narrow card fills the Apps slot and shifts subsequent cards into the next widths", () => {
    const before = structuredClone(DEFAULT_HUB_CARDS);
    const result = moveHubCardToSlot(DEFAULT_HUB_CARDS, "check-ins", "apps");
    expect(layout(result)).toEqual([
      ["profile", "narrow"],
      ["plans", "wide"],
      ["check-ins", "wide"],
      ["apps", "narrow"],
      ["progress", "narrow"],
      ["attune", "wide"],
    ]);
    expect(DEFAULT_HUB_CARDS).toEqual(before);
  });

  test("a wide card shrinks into a narrow slot and moving back restores the layout", () => {
    const result = moveHubCardToSlot(DEFAULT_HUB_CARDS, "apps", "progress");
    expect(layout(result)).toEqual([
      ["profile", "narrow"],
      ["plans", "wide"],
      ["progress", "wide"],
      ["apps", "narrow"],
      ["check-ins", "narrow"],
      ["attune", "wide"],
    ]);
    expect(layout(moveHubCardToSlot(result, "apps", "progress"))).toEqual(
      layout(DEFAULT_HUB_CARDS),
    );
  });

  test("hidden cards and the profile remain fixed, and custom card details survive", () => {
    const hidden: HubCardSetting = {
      id: "hidden",
      title: "Hidden",
      width: "wide",
      order: 2,
      hidden: true,
    };
    const custom: HubCardSetting = {
      id: "custom",
      title: "My link",
      width: "narrow",
      order: 8,
      to: "/account",
      detail: "Preferences",
      kind: "shortcut",
    };
    const cards = [...DEFAULT_HUB_CARDS, hidden, custom];
    const result = moveHubCardToSlot(cards, "custom", "plans");
    expect(result.find((card) => card.id === "hidden")).toBe(hidden);
    expect(result.find((card) => card.id === "profile")).toBe(cards[0]);
    expect(result.find((card) => card.id === "custom")).toEqual({
      ...custom,
      order: 1,
      width: "wide",
    });
    for (const [from, to] of [
      ["profile", "plans"],
      ["plans", "profile"],
      ["hidden", "apps"],
      ["missing", "apps"],
      ["apps", "apps"],
    ]) {
      expect(moveHubCardToSlot(cards, from!, to!)).toBe(cards);
    }
  });
});
