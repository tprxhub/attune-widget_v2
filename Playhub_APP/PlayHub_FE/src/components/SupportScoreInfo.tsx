import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const SUPPORT_SCORE_DEFINITION =
  "How much help was needed in the latest Play Dose, averaged across its finished sessions. 0% means on their own; 33% one reminder; 67% a few reminders; 100% hands-on help. A lower score means more independence. Unfinished sessions are excluded.";

/** "i" icon that explains the Support score on hover or keyboard focus. */
export function SupportScoreInfo({
  className,
  description = SUPPORT_SCORE_DEFINITION,
}: {
  className?: string;
  description?: string;
}) {
  return (
    <span className={cn("group/info relative inline-flex align-middle normal-case", className)}>
      <button
        type="button"
        aria-label="How Support Score is calculated"
        className="inline-flex cursor-help rounded-full focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-56 -translate-x-1/2 rounded-xl bg-navy px-3 py-2 text-left text-xs font-medium tracking-normal text-cream opacity-0 shadow-lg transition-opacity group-focus-within/info:opacity-100 group-hover/info:opacity-100"
      >
        {description}
      </span>
    </span>
  );
}
