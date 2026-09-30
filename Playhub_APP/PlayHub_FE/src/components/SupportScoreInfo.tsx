import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const SUPPORT_SCORE_DEFINITION =
  "Support score shows how much help a child needed during sessions, as a percentage. 0% means fully independent and 100% means hands-on help the whole time, so lower is better.";

/** "i" icon that explains the Support score on hover or keyboard focus. */
export function SupportScoreInfo({ className }: { className?: string }) {
  return (
    <span className={cn("group/info relative inline-flex align-middle normal-case", className)}>
      <button
        type="button"
        aria-label={SUPPORT_SCORE_DEFINITION}
        className="inline-flex cursor-help rounded-full focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-56 -translate-x-1/2 rounded-xl bg-navy px-3 py-2 text-left text-xs font-medium tracking-normal text-cream opacity-0 shadow-lg transition-opacity group-focus-within/info:opacity-100 group-hover/info:opacity-100"
      >
        {SUPPORT_SCORE_DEFINITION}
      </span>
    </span>
  );
}
