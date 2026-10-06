import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const SUPPORT_SCORE_DEFINITION =
  "Calculated only across one specific Play Dose (the latest one), never averaged across many doses. It is the average of that dose’s finished days: independent 0%, one reminder 33%, a few reminders 67%, hands-on help 100%. Lower is better.";

/** "i" icon that explains the Support score on hover or keyboard focus. */
export function SupportScoreInfo({ className }: { className?: string }) {
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
        {SUPPORT_SCORE_DEFINITION}
      </span>
    </span>
  );
}
