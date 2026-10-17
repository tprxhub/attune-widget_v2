import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CircleUserRound, CircleX, Settings } from "lucide-react";
import { useCapabilities, useSession } from "@/auth/session";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "./ProfileAvatar";
import { SignOutButton } from "./SignOutButton";

/**
 * The signed-in person's avatar in a header; it opens a small menu with their name, settings,
 * subscription (for families who manage one) and Sign out.
 */
export function AccountMenu({
  className,
  tone = "light",
}: {
  className?: string;
  /** "light" over a dark header or photo, "dark" over a light header. */
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { session } = useSession();
  const { canManageSubscription } = useCapabilities();
  const name = session.guardianName || session.name || "Your account";

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      // The sign-out confirmation is portalled outside this menu; clicks there must not close it.
      const target = event.target as HTMLElement;
      if (!rootRef.current?.contains(target) && !target.closest("[role='alertdialog']")) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("[role='alertdialog']")) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-navy transition-colors hover:bg-navy/6";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Your account"
        title="Your account"
        className={cn(
          "ph-pill grid h-11 w-11 place-items-center overflow-hidden transition-colors",
          tone === "light"
            ? open
              ? "bg-white/25"
              : "bg-white/10 hover:bg-white/20"
            : open
              ? "bg-navy/12"
              : "bg-navy/6 hover:bg-navy/10",
        )}
      >
        <ProfileAvatar
          name={name}
          photoUrl={session.avatarUrl}
          sticker={session.avatarSticker}
          className="h-10 w-10 !rounded-full text-sm"
        />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Your account"
          className="ph-rise absolute top-[calc(100%+0.6rem)] right-0 z-50 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[18px] border border-white/60 bg-card/80 text-navy shadow-[0_22px_50px_-18px_rgba(0,20,60,0.5)] backdrop-blur-2xl backdrop-saturate-150"
        >
          <p className="truncate border-b border-navy/8 bg-white/45 px-4 py-2.5 text-[15px] font-bold">
            {name}
          </p>
          <div className="p-1.5">
            <Link to="/account" role="menuitem" onClick={() => setOpen(false)} className={item}>
              <Settings className="h-4.5 w-4.5 shrink-0 text-blue" aria-hidden />
              Play Hub Settings
            </Link>
            {canManageSubscription && (
              <Link
                to="/subscription"
                search={{ checkout: undefined }}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(item, "text-blue")}
              >
                <CircleUserRound className="h-4.5 w-4.5 shrink-0" aria-hidden />
                Manage subscription
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </Link>
            )}
            <div className="mx-2 my-1 border-t border-navy/10" />
            <SignOutButton
              icon={CircleX}
              onSignedOut={() => setOpen(false)}
              className={cn(
                item,
                "justify-start gap-2.5 rounded-xl border-0 text-sm text-coral hover:bg-coral/9 [&>svg]:h-4.5 [&>svg]:w-4.5",
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
