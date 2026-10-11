import { Info } from "lucide-react";
import { useId, useRef, useState } from "react";
import { FloatingPanel } from "./FloatingPanel";
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
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <span className={cn("group/info relative inline-flex align-middle normal-case", className)}>
      <button
        ref={anchorRef}
        type="button"
        aria-label="How Support Score is calculated"
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        className="inline-flex cursor-help rounded-full focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <FloatingPanel
          anchorRef={anchorRef}
          panelRef={panelRef}
          className="pointer-events-none w-56 rounded-xl bg-navy px-3 py-2 text-left text-xs font-medium tracking-normal text-cream shadow-lg"
        >
          <span id={tooltipId} role="tooltip">
            {description}
          </span>
        </FloatingPanel>
      )}
    </span>
  );
}
