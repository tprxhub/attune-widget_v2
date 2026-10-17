import type { HubCardSetting } from "./hubTiles";

/** Move card contents through the layout while each position keeps its width. */
export function moveHubCardToSlot(cards: HubCardSetting[], sourceId: string, targetId: string) {
  const slots = cards
    .filter((card) => !card.hidden && card.id !== "profile")
    .sort((a, b) => a.order - b.order);
  const from = slots.findIndex((card) => card.id === sourceId);
  const to = slots.findIndex((card) => card.id === targetId);
  if (from < 0 || to < 0 || from === to) return cards;

  const moved = [...slots];
  moved.splice(to, 0, ...moved.splice(from, 1));
  const positions = new Map(
    moved.map((card, index) => [card.id, { order: index + 1, width: slots[index]!.width }]),
  );
  return cards.map((card) =>
    positions.has(card.id) ? { ...card, ...positions.get(card.id)! } : card,
  );
}
