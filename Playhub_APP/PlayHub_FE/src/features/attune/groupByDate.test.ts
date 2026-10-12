import { expect, test } from "bun:test";
import { groupByDate } from "./groupByDate";

test("past chats are grouped newest first into Today, Yesterday and older sections", () => {
  const now = new Date(2026, 9, 12, 15, 0);
  const at = (days: number, hour = 10) => ({
    id: `${days}-${hour}`,
    updatedAt: new Date(2026, 9, 12 - days, hour).toISOString(),
  });
  const groups = groupByDate([at(40), at(0, 9), at(1), at(3), at(0, 14), at(20)], now);
  expect(groups.map((g) => g.label)).toEqual([
    "Today",
    "Yesterday",
    "Previous 7 days",
    "Previous 30 days",
    "Older",
  ]);
  expect(groups[0]?.items.map((i) => i.id)).toEqual(["0-14", "0-9"]);
  expect(groupByDate([], now)).toEqual([]);
});
