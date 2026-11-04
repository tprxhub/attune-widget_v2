import { useId, useState } from "react";
import { BadgePercent, Check, Loader2, Tag, X } from "lucide-react";
import { estimateSaving, offerHeadline, type DiscountQuote, type Offer } from "@/api/discounts";
import { fmtDate } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const aed = (fils: number) => fmtMoney(fils / 100);

/**
 * "Offers & coupons": type a code or pick one of the available offers, shopping-app style. The
 * server works out the real saving (see the quote); the offer list only estimates it.
 */
export function OffersPanel({
  offers,
  months,
  amount,
  applied,
  checking,
  error,
  onApply,
  onRemove,
}: {
  offers: Offer[];
  months: number;
  amount: number;
  applied: DiscountQuote | null;
  checking: string | null;
  error: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [code, setCode] = useState("");
  const [showAll, setShowAll] = useState(false);
  const id = useId();
  const ranked = offers
    .map((offer) => ({ offer, saving: estimateSaving(offer, months, amount) }))
    .sort((a, b) => b.saving - a.saving);
  const shown = showAll ? ranked : ranked.slice(0, 3);

  return (
    <section aria-labelledby={id} className="ph-card p-5">
      <h2 id={id} className="flex items-center gap-2 text-lg font-bold">
        <BadgePercent className="h-5 w-5 text-coral" aria-hidden /> Offers &amp; coupons
      </h2>

      {applied ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[#1f7a45]/40 bg-[#e6f4ec] px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1f7a45] text-white">
            <Check className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold tracking-wide text-[#1f7a45] uppercase">
              {applied.code} applied
            </p>
            <p className="text-sm text-navy/75">
              You save <b className="text-navy">{aed(applied.discountAmount)}</b> on this plan
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-coral hover:bg-coral/10"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Remove
          </button>
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) onApply(code.trim());
          }}
        >
          <label htmlFor={`${id}-code`} className="sr-only">
            Coupon code
          </label>
          <span className="relative min-w-0 flex-1">
            <Tag
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-navy/40"
              aria-hidden
            />
            <input
              id={`${id}-code`}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className={cn(
                "min-h-11 w-full rounded-xl border bg-card pr-3 pl-10 text-sm font-bold tracking-wide uppercase outline-none placeholder:font-normal placeholder:tracking-normal placeholder:normal-case focus:ring-2",
                error
                  ? "border-coral focus:ring-coral/20"
                  : "border-navy/15 focus:border-blue focus:ring-blue/25",
              )}
            />
          </span>
          <button
            type="submit"
            disabled={!code.trim() || checking !== null}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 border-coral px-4 text-sm font-extrabold text-coral uppercase disabled:opacity-50"
          >
            {checking === code.trim() && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Apply
          </button>
        </form>
      )}
      {error && !applied && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-xs font-semibold text-coral">
          {error}
        </p>
      )}

      {ranked.length > 0 && (
        <>
          <p className="mt-5 text-xs font-bold tracking-[0.14em] text-navy/50 uppercase">
            Available offers
          </p>
          <ul className="mt-2 grid gap-2.5">
            {shown.map(({ offer, saving }) => {
              const isApplied = applied?.code === offer.code;
              return (
                <li
                  key={offer.code}
                  className={cn(
                    "relative flex gap-3 overflow-hidden rounded-2xl border p-3.5 pl-4",
                    isApplied ? "border-[#1f7a45]/40 bg-[#e6f4ec]/60" : "border-navy/10 bg-white",
                  )}
                >
                  <span className="absolute inset-y-0 left-0 w-1 bg-coral" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-navy">
                      {offerHeadline(offer)} · {offer.title}
                    </p>
                    {offer.description && (
                      <p className="mt-0.5 text-xs text-navy/65">{offer.description}</p>
                    )}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="rounded-md border border-dashed border-navy/30 px-2 py-0.5 font-mono font-bold tracking-wide text-navy">
                        {offer.code}
                      </span>
                      {saving > 0 ? (
                        <span className="font-bold text-[#1f7a45]">
                          Save {aed(saving)} on this plan
                        </span>
                      ) : (
                        <span className="text-navy/50">
                          {offer.plans.length
                            ? `For the ${offer.plans.map((m) => `${m}-month`).join(", ")} plan${offer.plans.length > 1 ? "s" : ""}`
                            : "Not available on this plan"}
                        </span>
                      )}
                      {offer.endsOn && (
                        <span className="text-navy/50">· Ends {fmtDate(offer.endsOn)}</span>
                      )}
                      {offer.newCustomersOnly && (
                        <span className="text-navy/50">· First subscription only</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={saving === 0 || isApplied || checking !== null}
                    onClick={() => onApply(offer.code)}
                    aria-label={`Apply ${offer.code}`}
                    className="self-center text-sm font-extrabold text-coral uppercase disabled:text-navy/35"
                  >
                    {checking === offer.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : isApplied ? (
                      "Applied"
                    ) : (
                      "Apply"
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {ranked.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((all) => !all)}
              className="mt-2 text-xs font-bold text-blue hover:underline"
            >
              {showAll ? "Show fewer offers" : `View all ${ranked.length} offers`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** "Price details", as at a shop's checkout. */
export function PriceDetails({
  label,
  amount,
  applied,
}: {
  label: string;
  amount: number;
  applied: DiscountQuote | null;
}) {
  const total = applied ? applied.finalAmount : amount;
  return (
    <div className="mt-5 rounded-2xl border border-navy/10 p-4">
      <p className="text-xs font-bold tracking-[0.14em] text-navy/50 uppercase">Price details</p>
      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-navy/70">{label} plan</dt>
          <dd className="font-semibold">{aed(applied ? applied.listAmount : amount)}</dd>
        </div>
        {applied && (
          <div className="flex justify-between gap-3">
            <dt className="text-navy/70">Coupon ({applied.code})</dt>
            <dd className="font-semibold text-[#1f7a45]">− {aed(applied.discountAmount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3 border-t border-dashed border-navy/15 pt-2 text-base">
          <dt className="font-bold">Total</dt>
          <dd className="font-extrabold">{aed(total)}</dd>
        </div>
      </dl>
      {applied && (
        <p className="mt-3 rounded-xl bg-[#e6f4ec] px-3 py-2 text-center text-sm font-bold text-[#1f7a45]">
          You save {aed(applied.discountAmount)} on this subscription
        </p>
      )}
    </div>
  );
}
