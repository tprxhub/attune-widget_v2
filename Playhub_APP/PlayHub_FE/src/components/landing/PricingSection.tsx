import { Link } from "@tanstack/react-router";
import { Building2, Check } from "lucide-react";
import { PLAN_FEATURES, PRICE_PLANS } from "@/api/subscriptions";
import { fmtMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const FREE_FEATURES = [
  "Browse every Play Plan",
  "The Introduction and the Day 0 Play Dose",
  "Play Pulse quick check",
];

/** Public pricing overview. Prices come from the same list the Subscription page uses. */
export function PricingSection({ signedIn }: { signedIn: boolean }) {
  const buyTo = signedIn ? "/subscription" : "/signup";
  return (
    <section
      id="pricing"
      className="mx-auto max-w-7xl scroll-mt-24 px-2 pb-16 sm:px-4 lg:pb-24"
      aria-labelledby="pricing-title"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-navy/50 uppercase">Pricing</p>
        <h2 id="pricing-title" className="ph-display mt-3 text-4xl leading-tight sm:text-5xl">
          Simple pricing, per child
        </h2>
        <p className="mt-4 text-base leading-relaxed text-navy/70">
          Start free. Subscribe for a child when you want the full week, every video and unlimited
          Session logging. One payment, no auto-renewal.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="ph-r-xl flex flex-col bg-card p-6 shadow-card">
          <h3 className="text-sm font-bold tracking-wide text-navy/60 uppercase">Free</h3>
          <p className="ph-display mt-3 text-4xl text-navy">{fmtMoney(0)}</p>
          <p className="text-xs font-semibold text-navy/55">Always free</p>
          <p className="mt-3 text-sm text-navy/70">
            Try Play Hub with your child before you commit.
          </p>
          <ul className="mt-5 mb-6 space-y-2 text-sm text-navy/75">
            {FREE_FEATURES.map((line) => (
              <li key={line} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <Link
            to={signedIn ? "/dashboard" : "/signup"}
            className="ph-pill mt-auto inline-flex min-h-11 items-center justify-center border border-navy/20 px-5 text-sm font-semibold text-navy hover:bg-navy/5"
          >
            {signedIn ? "Open Play Hub" : "Create a free account"}
          </Link>
        </article>

        {PRICE_PLANS.map((plan) => {
          const best = plan.duration === "12m";
          return (
            <article
              key={plan.duration}
              className={cn(
                "ph-r-xl relative flex flex-col p-6",
                best ? "bg-navy text-cream shadow-card" : "bg-card shadow-card",
              )}
            >
              {best && (
                <span className="absolute -top-3 left-6 rounded-full bg-amber px-3 py-1 text-[11px] font-bold text-navy">
                  Best value
                </span>
              )}
              <h3
                className={cn(
                  "text-sm font-bold tracking-wide uppercase",
                  best ? "text-cream/70" : "text-navy/60",
                )}
              >
                {plan.label}
              </h3>
              <p className="ph-display mt-3 text-4xl">{plan.price}</p>
              <p className={cn("text-xs font-semibold", best ? "text-cream/65" : "text-navy/55")}>
                {plan.per} · per child
              </p>
              <p className={cn("mt-3 text-sm", best ? "text-cream/80" : "text-navy/70")}>
                {plan.note}
              </p>
              <p
                className={cn(
                  "mt-5 mb-6 flex gap-2 text-sm font-semibold",
                  best ? "text-cream" : "text-navy",
                )}
              >
                <Check
                  className={cn("mt-0.5 h-4 w-4 shrink-0", best ? "text-amber" : "text-blue")}
                  aria-hidden
                />
                Everything in Free, plus every paid feature below
              </p>
              <Link
                to={buyTo}
                className={cn(
                  "ph-pill mt-auto inline-flex min-h-11 items-center justify-center px-5 text-sm font-semibold",
                  best
                    ? "bg-cream text-navy hover:bg-white"
                    : "bg-navy text-cream hover:bg-navy/90",
                )}
              >
                Choose {plan.label.toLowerCase()}
              </Link>
            </article>
          );
        })}
      </div>

      <div className="ph-r-xl mt-4 bg-card p-6 shadow-card sm:p-8">
        <h3 className="text-lg font-bold">Every paid plan includes</h3>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_FEATURES.map((line) => (
            <li key={line} className="flex gap-2 text-sm text-navy/75">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="ph-r-xl mt-4 flex flex-col gap-4 bg-navy/5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue/12 text-blue">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-lg font-bold">Schools &amp; clinics</h3>
            <p className="mt-1 text-sm text-navy/70">
              Billed by license for your organisation, not per child. Organisation accounts are set
              up by The Toy Pharmacy.
            </p>
          </div>
        </div>
        <a
          href="mailto:info@thetoypharmacy.com?subject=Play%20Hub%20for%20schools%20and%20clinics"
          className="ph-pill inline-flex min-h-11 shrink-0 items-center justify-center border border-navy/20 px-5 text-sm font-semibold text-navy hover:bg-navy/5"
        >
          Talk to us
        </a>
      </div>
    </section>
  );
}
