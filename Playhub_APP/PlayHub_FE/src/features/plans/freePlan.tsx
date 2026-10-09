import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Lock, Sparkles, X } from "lucide-react";
import { chooseFreePlan } from "@/api/children";
import { invalidatePlanCatalog } from "@/api/plans";
import { ModalPortal } from "@/components/ModalPortal";
import type { Goal, PlayPlan } from "@/lib/types";
import { useFreePlan } from "./useFreePlan";

/** Asks once, then opens `goal` as the child's free Play Plan. */
export function ChooseFreePlanDialog({
  goal,
  childName,
  childId,
  onClose,
}: {
  goal: Goal;
  childName: string;
  childId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const choose = useMutation({
    mutationFn: () => chooseFreePlan(childId, goal.id),
    onSuccess: async () => {
      // The catalog is cached outside React Query; drop it so the chosen dose's steps load.
      invalidatePlanCatalog();
      await Promise.all(
        [["children"], ["plans"], ["goals"], ["plan"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      onClose();
    },
  });

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] grid place-items-center bg-navy/55 p-4 backdrop-blur-sm"
        onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-plan-title"
          className="w-full max-w-md rounded-3xl bg-cream p-6 text-navy shadow-lift"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber text-navy">
              <Gift className="h-5 w-5" aria-hidden />
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-1 rounded-full p-2 text-navy/60 hover:bg-navy/8 hover:text-navy"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <h2 id="free-plan-title" className="mt-4 text-xl font-bold">
            Open {goal.name} for free?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-navy/70">
            On the free plan, {childName} can open the <b>Rookie Play Dose</b> of <b>one</b> Play
            Plan. You can’t swap it later; subscribing unlocks every Play Dose and Play Plan.
          </p>
          {choose.isError && (
            <p className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral">
              {choose.error instanceof Error
                ? choose.error.message
                : "That didn’t work. Try again."}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-full border border-navy/15 px-5 text-sm font-bold hover:border-navy/40"
            >
              Not now
            </button>
            <button
              ref={confirmRef}
              type="button"
              disabled={choose.isPending}
              onClick={() => choose.mutate()}
              className="min-h-11 rounded-full bg-navy px-5 text-sm font-bold text-cream hover:bg-navy/90 disabled:opacity-60"
            >
              {choose.isPending ? "Opening…" : `Open ${goal.short}`}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

/** The note at the top of the Play Plans page for a free family. */
export function FreePlanBanner({ goals }: { goals: Goal[] }) {
  const { active, child, chosenGoalId, canChoose, canManageSubscription } = useFreePlan();
  if (!active || !child) return null;
  const chosen = goals.find((goal) => goal.id === chosenGoalId);
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/50 bg-amber/15 px-4 py-3 text-navy">
      <p className="flex items-start gap-2.5 text-sm leading-snug">
        <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {chosen ? (
            <>
              <b>{chosen.name}</b> is {child.name}’s free Play Plan, with its Rookie Play Dose open.
              Subscribe to open every Play Dose and Play Plan.
            </>
          ) : canChoose ? (
            <>
              <b>Free plan:</b> choose one Play Plan and {child.name} gets its Rookie Play Dose.
              Everything else unlocks when you subscribe.
            </>
          ) : (
            <>The family account holder chooses which one Play Plan is free.</>
          )}
        </span>
      </p>
      {canManageSubscription && (
        <Link
          to="/subscription"
          search={{ checkout: undefined }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-coral px-4 text-xs font-bold text-white"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Subscribe
        </Link>
      )}
    </div>
  );
}

/** Stands in for a plan's page when the family can't open it on the free tier. */
export function FreePlanGate({ goal, dose }: { goal: Goal; dose?: PlayPlan }) {
  const { child, chosenGoalId, accessFor, canManageSubscription } = useFreePlan();
  const [choosing, setChoosing] = useState(false);
  const access = accessFor(goal, dose);
  const title = dose ? `${goal.name} · ${dose.level}` : goal.name;
  return (
    <section className="ph-card mt-4 p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-navy text-white">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-3 text-xl font-bold">{title} is locked on the free plan</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy/70">
        {access === "choose"
          ? "You can open the Rookie Play Dose of one Play Plan for free. Choose this one, or subscribe to open them all."
          : goal.id === chosenGoalId
            ? "The free plan opens only the Rookie Play Dose. Subscribe to open every level."
            : "Your free Play Plan is already chosen. Subscribe to open every Play Dose and Play Plan."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {access === "choose" && child && (
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="min-h-11 rounded-full bg-navy px-5 text-sm font-bold text-cream"
          >
            Open this one free
          </button>
        )}
        {canManageSubscription && (
          <Link
            to="/subscription"
            search={{ checkout: undefined }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Subscribe
          </Link>
        )}
      </div>
      {choosing && child && (
        <ChooseFreePlanDialog
          goal={goal}
          childId={child.id}
          childName={child.name}
          onClose={() => setChoosing(false)}
        />
      )}
    </section>
  );
}
