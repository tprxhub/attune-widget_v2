import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { LEVEL_GUIDANCE } from "@/api/domain";
import { STATUS_META } from "@/api/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { LevelDots } from "@/components/brand";
import { ModalPortal } from "@/components/ModalPortal";
import { useSession } from "@/auth/session";
import { LEVELS } from "@/lib/types";

/** Opens "How Play Hub works": the levels, the progress statuses and how a Play Plan runs. */
export function GuideButton({ label = "How Play Hub works" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-semibold transition-colors hover:border-navy/40"
      >
        <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">Guide</span>
      </button>
      {open && <GuideSheet onClose={() => setOpen(false)} />}
    </>
  );
}

export function GuideSheet({ onClose }: { onClose: () => void }) {
  const { session } = useSession();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const showPricing =
    session.role === "anonymous" || (session.accountType === "b2c" && session.tier === "free");

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How Play Hub works"
        className="fixed inset-0 z-60 flex items-end justify-center bg-navy/45 p-0 sm:items-center sm:p-6"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="ph-rise max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 sm:max-w-2xl sm:rounded-3xl sm:p-7"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              <p className="eyebrow text-coral">Guide</p>
              <h2 className="mt-1 text-2xl font-bold">How Play Hub works</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close guide"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-navy/5"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <section className="mt-5">
            <h3 className="text-sm font-bold">The four levels</h3>
            <ol className="mt-3 space-y-2">
              {[
                [
                  "Play Hub",
                  "Your home for guided play that helps your member build everyday skills.",
                ],
                [
                  "Play Plan",
                  "A step-by-step plan to build a specific skill, from buttoning shirts to using scissors”.",
                ],
                [
                  "Play Dose",
                  "A set of activities matched to your member’s level. Complete each dose to progress through Rookie, Starter and Pro.",
                ],
                [
                  "Activity",
                  "Small, guided tasks that help your member practise and build towards the main skill.",
                ],
              ].map(([term, desc], i) => (
                <li key={term} className="flex gap-3 rounded-2xl bg-navy/4 p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{term}</span>
                    <span className="block text-sm text-navy/90">{desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-bold">The levels</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <span key={l} className="rounded-full bg-navy/5 px-3 py-2">
                  <LevelDots level={l} />
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-navy/90">{LEVEL_GUIDANCE}</p>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-bold">What the status means</h3>
            <ul className="mt-3 space-y-2">
              {(
                [
                  "first_dose",
                  "settling_in",
                  "progressing",
                  "holding_steady",
                  "needs_check_in",
                ] as const
              ).map((s) => (
                <li key={s} className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={s} size="sm" />
                  <span className="min-w-0 flex-1 text-sm text-navy/90">{STATUS_META[s].hint}</span>
                </li>
              ))}
            </ul>
          </section>

          {showPricing && (
            <section className="mt-6">
              <h3 className="text-sm font-bold">Free vs subscribed</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-navy/12 p-4">
                  <p className="text-sm font-bold">Free</p>
                  <p className="mt-1 text-sm text-navy/90">
                    Explore all Play Plans and try a few practice activities in a selected Play
                    Dose. Subscribe to unlock full access and daily check-ins.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue/30 bg-blue/6 p-4">
                  <p className="text-sm font-bold text-blue">Subscribed (per member)</p>
                  <p className="mt-1 text-sm text-navy/90">
                    Access all Play Doses, videos, sessions and progress charts for your child.
                    Cancel within 7 days for a refund.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
