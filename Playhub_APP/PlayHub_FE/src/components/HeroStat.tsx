import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small stat tile used inside the dark hero panels.
 * `variant="figure"` shows a large number; `variant="text"` shows a truncating label.
 */
export function HeroStat({
  icon: Icon,
  label,
  value,
  sub,
  variant = "figure",
  className,
  info,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string | undefined;
  variant?: "figure" | "text";
  className?: string | undefined;
  info?: ReactNode;
}) {
  const figure = variant === "figure";
  return (
    <div className={cn("rounded-2xl p-3.5", figure ? "bg-white/10" : "bg-white/8", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-bold uppercase",
          figure ? "tracking-wide text-cream/70" : "tracking-[0.12em] text-cream/60",
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
        {info}
      </span>
      <p
        className={cn(
          "mt-1.5 font-bold text-cream",
          figure ? "text-2xl leading-none" : "truncate text-lg leading-tight",
        )}
      >
        {value}
      </p>
      {sub && (
        <p className={cn("text-[11px] text-cream/60", figure ? "mt-1" : "mt-0.5 truncate")}>
          {sub}
        </p>
      )}
    </div>
  );
}
