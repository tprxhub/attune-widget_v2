import { apiRequest } from "@/api/client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/session";
import { PRICING_QUERY_KEY, usePricePlans, type PricingCatalog } from "@/api/pricing";
import {
  pricingDraft,
  pricingDraftError,
  pricingFromDraft,
  type PriceDraft,
} from "@/features/billing/pricingDraft";

const CONTROL =
  "mt-1 block min-h-11 w-full rounded-xl border border-navy/20 bg-card px-3 py-2 text-sm text-navy";

function PricePlanFields({
  plan,
  index,
  onChange,
  onRemove,
  removable,
}: {
  plan: PriceDraft;
  index: number;
  onChange: (patch: Partial<PriceDraft>) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-navy/15 p-4">
      <legend className="px-1 text-sm font-bold">Plan {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">
          Plan name
          <input
            className={CONTROL}
            value={plan.label}
            maxLength={80}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </label>
        <label className="text-xs font-bold">
          Duration (months)
          <input
            type="number"
            min={1}
            max={60}
            step={1}
            className={CONTROL}
            value={plan.months}
            onChange={(event) => onChange({ months: event.target.value })}
          />
        </label>
        <label className="text-xs font-bold">
          Total price (AED)
          <input
            type="number"
            min={1}
            max={1000000}
            step="0.01"
            className={CONTROL}
            value={plan.price}
            onChange={(event) => onChange({ price: event.target.value })}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
          <input
            type="checkbox"
            checked={plan.featured}
            onChange={(event) => onChange({ featured: event.target.checked })}
          />{" "}
          Show badge
        </label>
        <label className="text-xs font-bold sm:col-span-2">
          Badge text
          <input
            className={CONTROL}
            value={plan.badge_text ?? "Best value"}
            maxLength={60}
            placeholder="e.g. Most popular, Save 20%, Recommended"
            onChange={(event) => onChange({ badge_text: event.target.value })}
          />
        </label>
        <label className="text-xs font-bold sm:col-span-2">
          Description
          <textarea
            className={CONTROL}
            rows={2}
            maxLength={600}
            value={plan.note}
            onChange={(event) => onChange({ note: event.target.value })}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!removable}
        onClick={onRemove}
        className="mt-3 min-h-10 text-xs font-bold text-coral disabled:opacity-40"
      >
        Remove plan {index + 1}
      </button>
    </fieldset>
  );
}

export function SubscriptionPricingEditor() {
  const { session } = useSession();
  if (session.role !== "super_admin") return null;
  return <PricingEditor />;
}

function PricingEditor() {
  const query = usePricePlans();
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<PriceDraft[] | null>(null);
  const [notice, setNotice] = useState("");
  const draft = edits ?? (query.data ? pricingDraft(query.data) : []);
  const dirty =
    edits !== null &&
    JSON.stringify(edits) !== JSON.stringify(query.data && pricingDraft(query.data));
  const error = pricingDraftError(draft);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = useMutation({
    mutationFn: () =>
      apiRequest<PricingCatalog>("/billing/plans", {
        method: "PUT",
        body: JSON.stringify(pricingFromDraft(draft)),
      }),
    onSuccess: (catalog) => {
      queryClient.setQueryData(PRICING_QUERY_KEY, catalog);
      setEdits(null);
      setNotice("Pricing saved. The homepage and subscription page now show these plans.");
    },
  });
  const update = (index: number, patch: Partial<PriceDraft>) => {
    setNotice("");
    setEdits(draft.map((plan, at) => (at === index ? { ...plan, ...patch } : plan)));
  };
  const add = () => {
    const months = Array.from({ length: 60 }, (_, index) => index + 1).find(
      (value) => !draft.some((plan) => Number(plan.months) === value),
    )!;
    setNotice("");
    setEdits([
      ...draft,
      {
        months: String(months),
        price: "",
        label: `${months}-Month`,
        note: "",
        featured: false,
        badge_text: "Best value",
      },
    ]);
  };
  return (
    <section className="ph-card p-5" aria-labelledby="subscription-pricing-heading">
      <h2 id="subscription-pricing-heading" className="text-lg font-bold">
        Subscription pricing
      </h2>
      <p className="mt-1 text-sm text-navy/65">
        Offer up to 5 paid plans. Set the month duration and total price per member in AED. Save
        pricing separately to publish the same options on the homepage and Subscription page.
      </p>
      {query.isPending ? (
        <p className="mt-4 text-sm">Loading pricing…</p>
      ) : query.isError ? (
        <p role="alert" className="mt-4 text-sm text-coral">
          Could not load pricing. Refresh to try again.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 xl:grid-cols-2">
            {draft.map((plan, index) => (
              <PricePlanFields
                key={index}
                plan={plan}
                index={index}
                removable={draft.length > 1}
                onChange={(patch) => update(index, patch)}
                onRemove={() => {
                  setEdits(draft.filter((_, at) => at !== index));
                  setNotice("");
                }}
              />
            ))}
          </fieldset>
          {dirty && error && (
            <p role="alert" className="text-sm text-coral">
              {error}
            </p>
          )}
          {save.error && (
            <p role="alert" className="text-sm text-coral">
              {save.error.message}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={draft.length >= 5 || save.isPending}
              onClick={add}
              className="min-h-11 rounded-full border border-navy/20 px-4 text-sm font-bold disabled:opacity-40"
            >
              Add subscription plan ({draft.length}/5)
            </button>
            <button
              type="button"
              disabled={!dirty || !!error || save.isPending}
              onClick={() => save.mutate()}
              className="min-h-11 rounded-full bg-navy px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              {save.isPending ? "Saving pricing…" : "Save pricing"}
            </button>
            {dirty && (
              <button
                type="button"
                disabled={save.isPending}
                onClick={() => {
                  setEdits(null);
                  setNotice("");
                }}
                className="min-h-11 px-2 text-sm font-bold"
              >
                Discard pricing changes
              </button>
            )}
          </div>
          {notice && (
            <p role="status" className="text-sm font-semibold text-blue">
              {notice}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
