import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgePercent, Layers, Tag, TrendingDown, type LucideIcon } from "lucide-react";
import { apiRequest } from "@/api/client";
import { DISCOUNTS_KEY, listDiscounts } from "@/api/discounts";
import { usePricePlans } from "@/api/pricing";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { SubscriptionPricingEditor } from "@/components/SubscriptionPricingEditor";
import { DiscountsManager } from "@/features/billing/DiscountsManager";
import { fmtMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Tab = "plans" | "discounts";

export const Route = createFileRoute("/admin/subscription")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab | undefined } => ({
    tab: search["tab"] === "discounts" ? "discounts" : undefined,
  }),
  head: () => ({ meta: [{ title: "Subscription — Play Hub admin" }] }),
  component: () => (
    <Protected roles={["super_admin"]}>
      <SubscriptionAdmin />
    </Protected>
  ),
});

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "plans", label: "Plans & pricing", icon: Layers },
  { id: "discounts", label: "Discounts & coupons", icon: BadgePercent },
];

/** Family subscriptions in one place: what is sold (plans and prices) and what it's sold for (offers). */
function SubscriptionAdmin() {
  const tab: Tab = Route.useSearch().tab ?? "plans";
  const pricing = usePricePlans();
  const discounts = useQuery({ queryKey: DISCOUNTS_KEY, queryFn: listDiscounts });
  const rows = discounts.data ?? [];
  // Families can only pay once Stripe is set up on the server.
  const status = useQuery({
    queryKey: ["billing", "status"],
    queryFn: () => apiRequest<{ stripe_configured: boolean }>("/billing/status"),
    retry: false,
  });
  const cheapest = Math.min(...pricing.plans.map((plan) => plan.amount / plan.months));

  const stats: { label: string; value: string; hint: string; icon: LucideIcon }[] = [
    {
      label: "Plans on sale",
      value: String(pricing.plans.length),
      hint: Number.isFinite(cheapest) ? `From ${fmtMoney(Math.round(cheapest) / 100)} / month` : "",
      icon: Layers,
    },
    {
      label: "Live offers",
      value: discounts.isSuccess ? String(rows.filter((d) => d.status === "active").length) : "–",
      hint: `${rows.length} coupon${rows.length === 1 ? "" : "s"} in total`,
      icon: Tag,
    },
    {
      label: "Coupon uses",
      value: discounts.isSuccess ? String(rows.reduce((n, d) => n + d.uses, 0)) : "–",
      hint: "Paid subscriptions with a coupon",
      icon: BadgePercent,
    },
    {
      label: "Customers saved",
      value: discounts.isSuccess ? fmtMoney(rows.reduce((n, d) => n + d.totalSaved, 0) / 100) : "–",
      hint: "Across every coupon",
      icon: TrendingDown,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Subscription"
        description="The plans families can buy, their prices, and the discounts and coupons they can use at checkout."
      />

      {status.data && !status.data.stripe_configured && (
        <p
          role="alert"
          className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
        >
          Stripe isn’t set up on the server, so families can’t pay yet.
        </p>
      )}

      <section
        aria-label="Subscription overview"
        className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="ph-card flex items-start gap-3 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy/6 text-navy">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-wide text-navy/55 uppercase">{label}</p>
              <p className="mt-0.5 text-2xl leading-tight font-bold">{value}</p>
              {hint && <p className="truncate text-xs text-navy/55">{hint}</p>}
            </div>
          </div>
        ))}
      </section>

      <div
        role="tablist"
        aria-label="Subscription settings"
        className="mt-6 flex gap-1 overflow-x-auto border-b border-navy/10"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            to="/admin/subscription"
            search={id === "plans" ? {} : { tab: id }}
            role="tab"
            aria-selected={tab === id}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors",
              tab === id
                ? "border-coral text-navy"
                : "border-transparent text-navy/55 hover:text-navy",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        ))}
      </div>

      <div role="tabpanel" className="mt-5">
        {tab === "plans" ? <SubscriptionPricingEditor /> : <DiscountsManager />}
      </div>
    </>
  );
}
