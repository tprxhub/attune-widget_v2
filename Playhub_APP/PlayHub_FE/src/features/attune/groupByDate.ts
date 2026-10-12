/** Chat history sections, newest first, the way ChatGPT and Claude group past chats. */
export type HistoryGroup<T> = { label: string; items: T[] };

const LABELS = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"] as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function groupByDate<T extends { updatedAt: string }>(
  items: T[],
  now: Date = new Date(),
): HistoryGroup<T>[] {
  const today = startOfDay(now);
  const day = 24 * 60 * 60 * 1000;
  const buckets = new Map<string, T[]>(LABELS.map((label) => [label, []]));
  const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const item of sorted) {
    const age = (today - startOfDay(new Date(item.updatedAt))) / day;
    const label =
      age <= 0
        ? "Today"
        : age <= 1
          ? "Yesterday"
          : age <= 7
            ? "Previous 7 days"
            : age <= 30
              ? "Previous 30 days"
              : "Older";
    buckets.get(label)?.push(item);
  }
  return LABELS.map((label) => ({ label, items: buckets.get(label) ?? [] })).filter(
    (group) => group.items.length > 0,
  );
}
