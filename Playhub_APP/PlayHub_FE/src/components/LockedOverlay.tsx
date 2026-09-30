import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useCapabilities } from "@/auth/session";
import { cn } from "@/lib/utils";

interface LockedOverlayProps {
  locked: boolean;
  children: ReactNode;
  title?: string;
  message?: string;
  ctaLabel?: string;
  ctaTo?: string;
  className?: string;
  compact?: boolean;
}

/** Locked content is shown, not hidden: blurred + lock + "Upgrade to unlock". */
export function LockedOverlay({
  locked,
  children,
  title = "Locked on the free plan",
  message = "Subscribe for this child to unlock every Play Dose, video and Session logging.",
  ctaLabel = "Upgrade to unlock",
  ctaTo = "/subscription",
  className,
  compact = false,
}: LockedOverlayProps) {
  const { canManageSubscription } = useCapabilities();
  if (!locked) return <>{children}</>;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div
        aria-hidden
        className="pointer-events-none blur-[5px] select-none [filter:blur(5px)_grayscale(0.35)]"
      >
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-cream/70 p-4 text-center backdrop-blur-[2px]">
        <div className={cn("max-w-xs", compact && "max-w-[15rem]")}>
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-navy text-white">
            <Lock className="h-4.5 w-4.5" aria-hidden />
          </span>
          <p className="mt-2 text-sm font-bold">{title}</p>
          {!compact && <p className="mt-1 text-xs leading-snug text-navy/70">{message}</p>}
          {canManageSubscription && (
            <Link
              to={ctaTo}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
