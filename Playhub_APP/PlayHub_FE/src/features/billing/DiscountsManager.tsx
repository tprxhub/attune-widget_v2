import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Loader2, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import {
  DISCOUNTS_KEY,
  OFFERS_KEY,
  createDiscount,
  deleteDiscount,
  listDiscounts,
  offerHeadline,
  updateDiscount,
  type Discount,
  type DiscountInput,
  type DiscountStatus,
} from "@/api/discounts";
import { usePricePlans } from "@/api/pricing";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ListSkeleton } from "@/components/Skeletons";
import { Sheet } from "@/features/org/BillingSchedule";
import { fmtDate } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATUS: Record<DiscountStatus, { label: string; className: string }> = {
  active: { label: "Live", className: "bg-[#e6f4ec] text-[#1f7a45]" },
  scheduled: { label: "Scheduled", className: "bg-blue/10 text-blue" },
  ended: { label: "Ended", className: "bg-navy/8 text-navy/55" },
  used_up: { label: "Fully used", className: "bg-amber/25 text-[#9b6208]" },
  paused: { label: "Paused", className: "bg-coral/12 text-coral" },
};

const aed = (fils: number) => fmtMoney(fils / 100);

const EMPTY: DiscountInput = {
  code: "",
  title: "",
  description: "",
  kind: "percent",
  value: 10,
  maxDiscount: null,
  plans: [],
  startsOn: null,
  endsOn: null,
  maxUses: null,
  oncePerAccount: true,
  newCustomersOnly: false,
  showInOffers: true,
  isActive: true,
};

const toInput = (d: Discount): DiscountInput => ({
  code: d.code,
  title: d.title,
  description: d.description ?? "",
  kind: d.kind,
  value: d.value,
  maxDiscount: d.maxDiscount,
  plans: d.plans,
  startsOn: d.startsOn,
  endsOn: d.endsOn,
  maxUses: d.maxUses,
  oncePerAccount: d.oncePerAccount,
  newCustomersOnly: d.newCustomersOnly,
  showInOffers: d.showInOffers,
  isActive: d.isActive,
});

/** Discounts & coupons: create, edit, pause and delete the offers families can use at checkout. */
export function DiscountsManager() {
  const queryClient = useQueryClient();
  const discounts = useQuery({ queryKey: DISCOUNTS_KEY, queryFn: listDiscounts });
  const [editing, setEditing] = useState<Discount | "new" | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: DISCOUNTS_KEY });
    void queryClient.invalidateQueries({ queryKey: OFFERS_KEY });
  };
  const toggle = useMutation({
    mutationFn: (d: Discount) => updateDiscount(d.id, { ...toInput(d), isActive: !d.isActive }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: deleteDiscount, onSuccess: refresh });

  const rows = discounts.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Discounts &amp; coupons</h2>
          <p className="mt-1 max-w-2xl text-sm text-navy/60">
            Coupons for family subscriptions. Offers marked “Show in offers” appear on the
            Subscription page; others work only for people who know the code.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden /> New discount
        </button>
      </div>

      {(toggle.error || remove.error) && (
        <p role="alert" className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral">
          {(toggle.error ?? remove.error)?.message}
        </p>
      )}

      {discounts.isLoading ? (
        <div className="mt-5">
          <ListSkeleton rows={3} />
        </div>
      ) : discounts.isError ? (
        <p className="ph-card mt-5 p-6 text-sm text-navy/60">Discounts couldn’t be loaded.</p>
      ) : rows.length === 0 ? (
        <div className="ph-card mt-5 p-8 text-center">
          <BadgePercent className="mx-auto h-8 w-8 text-coral" aria-hidden />
          <p className="mt-2 font-bold">No discounts yet</p>
          <p className="mt-1 text-sm text-navy/60">
            Create a coupon such as WELCOME10 for 10% off a first subscription.
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 lg:grid-cols-2" aria-label="Discounts">
          {rows.map((d) => (
            <li
              key={d.id}
              aria-label={d.code}
              className="ph-card relative flex flex-col overflow-hidden p-5 pl-6"
            >
              <span className="absolute inset-y-0 left-0 w-1.5 bg-coral" aria-hidden />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-lg font-extrabold tracking-wide">{d.code}</p>
                  <p className="text-sm font-bold text-navy/80">
                    {offerHeadline(d)} · {d.title}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide uppercase",
                    STATUS[d.status].className,
                  )}
                >
                  {STATUS[d.status].label}
                </span>
              </div>
              {d.description && <p className="mt-2 text-sm text-navy/65">{d.description}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <Fact label="Plans">
                  {d.plans.length ? d.plans.map((m) => `${m}-month`).join(", ") : "All plans"}
                </Fact>
                <Fact label="Runs">
                  {d.startsOn || d.endsOn
                    ? `${d.startsOn ? fmtDate(d.startsOn) : "Now"} – ${d.endsOn ? fmtDate(d.endsOn) : "no end"}`
                    : "Always"}
                </Fact>
                <Fact label="Used">
                  {d.uses}
                  {d.maxUses ? ` of ${d.maxUses}` : ""} · saved {aed(d.totalSaved)}
                </Fact>
                <Fact label="Rules">
                  {[
                    d.oncePerAccount && "Once per account",
                    d.newCustomersOnly && "First subscription",
                    d.showInOffers ? "Shown in offers" : "Code only",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Fact>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(d)}
                  aria-label={`Edit ${d.code}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-navy/15 px-3.5 text-xs font-bold hover:border-navy/40"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggle.mutate(d)}
                  disabled={toggle.isPending}
                  aria-label={`${d.isActive ? "Pause" : "Resume"} ${d.code}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-navy/15 px-3.5 text-xs font-bold hover:border-navy/40 disabled:opacity-50"
                >
                  {d.isActive ? (
                    <Pause className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Play className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {d.isActive ? "Pause" : "Resume"}
                </button>
                {d.uses === 0 && (
                  <ConfirmButton
                    confirmationTitle={`Delete ${d.code}?`}
                    confirmationMessage="The coupon stops working straight away. This can’t be undone."
                    confirmLabel="Delete discount"
                    onClick={() => remove.mutateAsync(d.id)}
                    aria-label={`Delete ${d.code}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-coral/30 px-3.5 text-xs font-bold text-coral hover:bg-coral/8"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                  </ConfirmButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <DiscountForm
          discount={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-bold text-navy/50">{label}</dt>
      <dd className="text-navy/80">{children}</dd>
    </div>
  );
}

const CONTROL =
  "mt-1.5 w-full rounded-xl border border-navy/15 bg-card px-3.5 py-2.5 text-sm text-navy outline-none focus:border-blue focus:ring-2 focus:ring-blue/25";

function DiscountForm({
  discount,
  onClose,
  onSaved,
}: {
  discount: Discount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pricing = usePricePlans();
  const [form, setForm] = useState<DiscountInput>(discount ? toInput(discount) : EMPTY);
  // Money is typed in AED and stored in fils.
  const [valueText, setValueText] = useState(
    discount ? String(discount.kind === "amount" ? discount.value / 100 : discount.value) : "10",
  );
  const [capText, setCapText] = useState(
    discount?.maxDiscount ? String(discount.maxDiscount / 100) : "",
  );
  const [usesText, setUsesText] = useState(discount?.maxUses ? String(discount.maxUses) : "");
  const [error, setError] = useState("");
  const set = (change: Partial<DiscountInput>) => setForm((current) => ({ ...current, ...change }));

  const save = useMutation({
    mutationFn: (input: DiscountInput) =>
      discount ? updateDiscount(discount.id, input) : createDiscount(input),
    onSuccess: onSaved,
  });

  const submit = () => {
    const value = Number(valueText);
    const cap = capText.trim() ? Number(capText) : null;
    const maxUses = usesText.trim() ? Number(usesText) : null;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/.test(form.code.trim()))
      return setError("Use 3–40 letters, numbers, - or _ for the code, e.g. WELCOME10.");
    if (form.title.trim().length < 2) return setError("Give the offer a short title.");
    if (form.kind === "percent" && !(Number.isInteger(value) && value >= 1 && value <= 90))
      return setError("A percentage discount is a whole number from 1 to 90.");
    if (form.kind === "amount" && !(value >= 1)) return setError("Enter the amount off in AED.");
    if (cap !== null && !(cap >= 1))
      return setError("The cap is an amount in AED, or leave it empty.");
    if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses >= 1))
      return setError("The usage limit is a whole number, or leave it empty for no limit.");
    if (form.startsOn && form.endsOn && form.endsOn < form.startsOn)
      return setError("The end date must be on or after the start date.");
    setError("");
    save.mutate({
      ...form,
      code: form.code.trim().toUpperCase(),
      value: form.kind === "amount" ? Math.round(value * 100) : value,
      maxDiscount: form.kind === "percent" && cap !== null ? Math.round(cap * 100) : null,
      maxUses,
    });
  };

  const months = pricing.plans.map((plan) => plan.months);
  return (
    <Sheet
      title={discount ? `Edit ${discount.code}` : "New discount"}
      subtitle="Applies to family subscriptions at checkout"
      onClose={onClose}
    >
      <form
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Coupon code
            <input
              value={form.code}
              onChange={(event) => set({ code: event.target.value.toUpperCase() })}
              placeholder="WELCOME10"
              className={cn(CONTROL, "font-mono tracking-wide uppercase")}
            />
          </label>
          <label className="text-sm font-bold">
            Title
            <input
              value={form.title}
              onChange={(event) => set({ title: event.target.value })}
              placeholder="Welcome offer"
              maxLength={80}
              className={CONTROL}
            />
          </label>
        </div>
        <label className="text-sm font-bold">
          Description <span className="font-normal text-navy/50">(optional)</span>
          <input
            value={form.description}
            onChange={(event) => set({ description: event.target.value })}
            placeholder="10% off your first Play Hub subscription"
            maxLength={300}
            className={CONTROL}
          />
        </label>

        <fieldset>
          <legend className="text-sm font-bold">Discount</legend>
          <div className="mt-1.5 inline-flex rounded-xl bg-navy/6 p-1" role="group">
            {(
              [
                ["percent", "% off"],
                ["amount", "AED off"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={form.kind === kind}
                onClick={() => set({ kind })}
                className={cn(
                  "min-h-9 rounded-lg px-4 text-sm font-bold",
                  form.kind === kind ? "bg-card shadow-sm" : "text-navy/60",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              {form.kind === "percent" ? "Percentage off" : "Amount off (AED)"}
              <input
                inputMode="decimal"
                value={valueText}
                onChange={(event) => setValueText(event.target.value)}
                className={CONTROL}
              />
            </label>
            {form.kind === "percent" && (
              <label className="text-sm font-bold">
                Up to (AED) <span className="font-normal text-navy/50">(optional cap)</span>
                <input
                  inputMode="decimal"
                  value={capText}
                  onChange={(event) => setCapText(event.target.value)}
                  placeholder="No cap"
                  className={CONTROL}
                />
              </label>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold">Plans</legend>
          <p className="text-xs text-navy/55">Leave all unticked for every plan.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {months.map((m) => {
              const on = form.plans.includes(m);
              return (
                <label
                  key={m}
                  className={cn(
                    "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-bold",
                    on ? "border-coral bg-coral/8 text-coral" : "border-navy/15",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      set({ plans: on ? form.plans.filter((x) => x !== m) : [...form.plans, m] })
                    }
                    className="sr-only"
                  />
                  {m}-month
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-bold">
            Starts
            <input
              type="date"
              value={form.startsOn ?? ""}
              onChange={(event) => set({ startsOn: event.target.value || null })}
              className={CONTROL}
            />
          </label>
          <label className="text-sm font-bold">
            Ends
            <input
              type="date"
              value={form.endsOn ?? ""}
              onChange={(event) => set({ endsOn: event.target.value || null })}
              className={CONTROL}
            />
          </label>
          <label className="text-sm font-bold">
            Usage limit
            <input
              inputMode="numeric"
              value={usesText}
              onChange={(event) => setUsesText(event.target.value)}
              placeholder="No limit"
              className={CONTROL}
            />
          </label>
        </div>

        <div className="grid gap-2">
          {(
            [
              [
                "showInOffers",
                "Show in “Available offers”",
                "Otherwise only people who know the code can use it.",
              ],
              ["oncePerAccount", "Once per account", "Each family can use it one time."],
              [
                "newCustomersOnly",
                "First subscription only",
                "Only families who have never paid before.",
              ],
              ["isActive", "Active", "Pause it any time without deleting it."],
            ] as const
          ).map(([key, label, hint]) => (
            <label
              key={key}
              className="flex items-start gap-3 rounded-xl border border-navy/10 p-3"
            >
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(event) => set({ [key]: event.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--color-coral)]"
              />
              <span>
                <span className="block text-sm font-bold">{label}</span>
                <span className="block text-xs text-navy/55">{hint}</span>
              </span>
            </label>
          ))}
        </div>

        {(error || save.error) && (
          <p role="alert" className="text-sm font-semibold text-coral">
            {error || save.error?.message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full bg-navy/6 px-5 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {discount ? "Save discount" : "Create discount"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
