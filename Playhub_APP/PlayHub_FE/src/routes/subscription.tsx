import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import {
  PLAN_FEATURES,
  PRICE_PLANS,
  checkout,
  daysLeftLabel,
  getSubscription,
  refundSubscription,
  subscriptionStage,
} from "@/api/subscriptions";
import { useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { ChildAvatar } from "@/components/brand";
import { useActiveChild } from "@/lib/active-child";
import type { PlanDuration } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/subscription")({
  validateSearch: (search: Record<string, unknown>) => ({
    checkout:
      search["checkout"] === "success" || search["checkout"] === "cancelled"
        ? search["checkout"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Subscription — Play Hub" },
      {
        name: "description",
        content:
          "Subscribe per child for 3, 6 or 12 months to unlock every Play Dose and Session logging.",
      },
      { property: "og:title", content: "Subscription — Play Hub" },
      { property: "og:description", content: "Subscribe per child for 3, 6 or 12 months." },
    ],
  }),
  component: () => (
    <Protected roles={["parent"]} accountTypes={["b2c"]}>
      <SubscriptionPage />
    </Protected>
  ),
});

function SubscriptionPage() {
  const { checkout: checkoutResult } = Route.useSearch();
  const { session, refreshSession } = useSession();
  const { activeChild, children } = useActiveChild();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PlanDuration>("6m");

  const childId = activeChild?.id;
  const sub = useQuery({
    queryKey: ["sub", childId],
    queryFn: () => getSubscription(childId!),
    enabled: !!childId,
    refetchInterval: (query) =>
      checkoutResult === "success" && query.state.data?.status !== "active" ? 1500 : false,
  });

  const buy = useMutation({
    mutationFn: () => checkout(childId!, selected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub", childId] });
      if (session.tier === "free") queryClient.invalidateQueries();
    },
  });

  const cancel = useMutation({
    mutationFn: () => refundSubscription(childId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sub", childId] });
      await refreshSession();
    },
  });

  useEffect(() => {
    if (sub.data?.status === "active" && session.tier !== "subscribed") {
      void refreshSession();
    }
  }, [refreshSession, session.tier, sub.data?.status]);

  // Step guard: you can't check out without a child on the account.
  if (children.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Billing" title="Subscription" />
        <div className="ph-card mx-auto max-w-md p-8 text-center">
          <p className="text-lg font-bold">Add a child first</p>
          <p className="mt-2 text-sm text-navy/70">
            Play Hub subscriptions are per child, so there's nothing to check out until a child is
            on your account.
          </p>
        </div>
      </>
    );
  }

  const active = sub.data?.status === "active";
  const { stage, lastDay, daysLeft } = subscriptionStage(sub.data);
  // During the last days an active subscription can be renewed; it carries on from the last day.
  const canRenew = active && !!sub.data?.renewalOpen;

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Subscription"
        description="Each subscription unlocks one child. A shared family login still needs a subscription per child."
      />

      {checkoutResult && (
        <p
          role="status"
          className={cn(
            "mt-5 rounded-2xl px-4 py-3 text-sm font-semibold",
            checkoutResult === "success" ? "bg-blue/10 text-blue" : "bg-amber/20 text-navy",
          )}
        >
          {checkoutResult === "success"
            ? active
              ? "Payment confirmed. The subscription is active."
              : "Payment received. Waiting for secure confirmation from Stripe…"
            : "Checkout was cancelled. No payment was taken."}
        </p>
      )}

      {sub.isLoading || !sub.data ? (
        <div className="mt-5">
          <CardSkeleton lines={3} />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <section className="ph-card p-5">
            <p className="eyebrow text-blue">Current status</p>
            <h2 className="mt-2 flex items-center gap-2 text-lg font-bold">
              {activeChild && (
                <ChildAvatar name={activeChild.name} token={activeChild.colorToken} size={30} />
              )}
              <span className="truncate">{activeChild?.name}</span>
            </h2>
            <p
              className={cn(
                "mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold",
                active && stage !== "ending" ? "bg-blue/12 text-blue" : "bg-amber/30 text-navy",
              )}
            >
              {stage === "ending"
                ? `Ends ${daysLeftLabel(daysLeft ?? 0)}`
                : active
                  ? "Subscribed"
                  : stage === "ended"
                    ? "Subscription ended"
                    : "Free plan"}
            </p>
            {lastDay && (stage === "active" || stage === "ending" || stage === "ended") && (
              <dl className="mt-4 space-y-2 text-sm">
                {active && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-navy/60">Plan</dt>
                    <dd className="font-bold">{sub.data.priceLabel}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-navy/60">
                    {stage === "ended" ? "Ended on" : "Last day of subscription"}
                  </dt>
                  <dd className="text-right font-bold">{fmtDate(lastDay)}</dd>
                </div>
                {active && daysLeft !== null && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-navy/60">Days left</dt>
                    <dd className="font-bold">{daysLeft === 0 ? "Last day today" : daysLeft}</dd>
                  </div>
                )}
              </dl>
            )}
            {stage === "ending" && (
              <p className="mt-4 rounded-2xl bg-amber/15 px-4 py-3 text-sm text-navy/80">
                {canRenew
                  ? `Renew now to keep ${activeChild?.name ?? "your child"}’s Play Plan going. The new plan starts the day after ${fmtDate(lastDay!)}, so no days are lost.`
                  : `Renewing opens in the last days of the subscription.`}
              </p>
            )}
            {active && sub.data.refundWindowEndsAt ? (
              <>
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-navy/20 text-sm font-bold disabled:opacity-60"
                >
                  {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Request full refund
                </button>
                {sub.data.refundWindowEndsAt && (
                  <p className="mt-3 text-xs text-navy/60">
                    Request by {fmtDate(sub.data.refundWindowEndsAt)} for a full refund.
                  </p>
                )}
              </>
            ) : stage === "ended" ? (
              <p className="mt-4 text-sm text-navy/70">
                Every Session is still saved. Re-subscribe to unlock logging and the full Progress
                chart again.
              </p>
            ) : !active ? (
              <p className="mt-4 text-sm text-navy/70">
                On the free plan you get the Introduction and first Activity. Logging Sessions stays
                locked.
              </p>
            ) : null}
            {(cancel.error || buy.error) && (
              <p role="alert" className="mt-3 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral">
                {(cancel.error ?? buy.error)?.message}
              </p>
            )}
          </section>

          <section>
            <div className="grid gap-4 sm:grid-cols-3">
              {PRICE_PLANS.map((p) => {
                const isSelected = selected === p.duration;
                return (
                  <button
                    key={p.duration}
                    type="button"
                    onClick={() => setSelected(p.duration)}
                    aria-pressed={isSelected}
                    className={cn(
                      "ph-card p-5 text-left transition-transform",
                      isSelected
                        ? "-translate-y-0.5 border-2 border-coral"
                        : "border-2 border-transparent hover:-translate-y-0.5",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-sm font-bold">{p.label}</span>
                      {p.duration === "12m" && (
                        <span className="rounded-full bg-amber/30 px-2 py-0.5 text-[10px] font-bold">
                          Best value
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block text-3xl font-bold">{p.price}</span>
                    <span className="block text-xs font-semibold text-navy/55">{p.per}</span>
                    <span className="mt-3 block text-xs text-navy/70">{p.note}</span>
                  </button>
                );
              })}
            </div>

            <div className="ph-card mt-5 p-5">
              <h2 className="text-lg font-bold">What unlocks for {activeChild?.name}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {PLAN_FEATURES.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-navy/75">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => buy.mutate()}
                disabled={buy.isPending || (active && !canRenew)}
                className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-coral px-6 text-base font-bold text-white disabled:opacity-60"
              >
                {buy.isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
                {canRenew
                  ? `Renew ${activeChild?.name} — ${PRICE_PLANS.find((p) => p.duration === selected)?.price}`
                  : active
                    ? "Already subscribed"
                    : `${stage === "ended" ? "Re-subscribe" : "Subscribe"} ${activeChild?.name} — ${PRICE_PLANS.find((p) => p.duration === selected)?.price}`}
              </button>
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-navy/55">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure card payment via Stripe.
                Cancel within 7 days for a full refund.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
