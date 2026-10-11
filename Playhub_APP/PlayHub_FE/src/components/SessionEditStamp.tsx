import { fmtDateTime } from "@/lib/format";
import type { Attempt } from "@/lib/types";

/** Keep correction metadata separate from the original session date on narrow screens. */
export function SessionEditStamp({ session }: { session: Pick<Attempt, "editedAt" | "editedBy"> }) {
  if (!session.editedAt) return null;
  // SQLite can serialize UTC timestamps without an offset.
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(session.editedAt)
    ? session.editedAt
    : `${session.editedAt}Z`;
  return (
    <span className="mt-1 block text-[11px] font-semibold text-blue">
      Edited · <time dateTime={timestamp}>{fmtDateTime(timestamp)}</time>
      {session.editedBy && <span> · by {session.editedBy}</span>}
    </span>
  );
}
