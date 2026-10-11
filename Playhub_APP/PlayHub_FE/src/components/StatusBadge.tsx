import { useId, useRef, useState } from "react";
import { FloatingPanel } from "./FloatingPanel";
import { TrendingUp, Minus, TrendingDown, HelpCircle, Sparkles } from "lucide-react";
import { STATUS_META } from "@/api/progress";
import type { StatusKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = {
  first_dose: Sparkles,
  progressing: TrendingUp,
  holding_steady: Minus,
  needs_check_in: TrendingDown,
  settling_in: Sparkles,
  no_data: HelpCircle,
} as const;

const STATUS_STYLES: Record<StatusKey, string> = {
  first_dose: "bg-amber/25 text-navy",
  progressing: "bg-emerald-100 text-emerald-700",
  holding_steady: "bg-slate-200 text-slate-700",
  needs_check_in: "bg-coral/12 text-coral",
  settling_in: "bg-blue/12 text-blue",
  no_data: "bg-navy/10 text-navy",
};

export function StatusIcon({
  status,
  size = "md",
  pixelSize,
}: {
  status: StatusKey;
  size?: "sm" | "md" | "lg";
  pixelSize?: number;
}) {
  const Icon = ICONS[status];
  const dimensions = size === "lg" ? "h-8 w-8" : size === "md" ? "h-6 w-6" : "h-4 w-4";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        STATUS_STYLES[status],
        size === "lg" ? "h-16 w-16" : size === "md" ? "h-11 w-11" : "h-8 w-8",
      )}
      style={pixelSize ? { width: pixelSize, height: pixelSize } : undefined}
      aria-hidden
    >
      <Icon
        className={pixelSize ? undefined : dimensions}
        style={
          pixelSize
            ? { width: Math.round(pixelSize / 2), height: Math.round(pixelSize / 2) }
            : undefined
        }
      />
    </span>
  );
}

export function StatusBadge({ status, size = "md" }: { status: StatusKey; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const meta = STATUS_META[status];
  const Icon = ICONS[status];
  return (
    <span className="relative inline-flex">
      <button
        ref={anchorRef}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={`${meta.label} — ${meta.hint}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-bold transition-transform active:scale-95",
          STATUS_STYLES[status],
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        )}
      >
        <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        {meta.label}
      </button>
      {open && (
        <FloatingPanel
          anchorRef={anchorRef}
          panelRef={panelRef}
          className="pointer-events-none w-56 rounded-xl bg-navy px-3 py-2 text-xs leading-snug font-medium text-white shadow-[var(--shadow-lift)]"
        >
          <span id={tooltipId} role="tooltip">
            {meta.hint}
          </span>
        </FloatingPanel>
      )}
    </span>
  );
}
