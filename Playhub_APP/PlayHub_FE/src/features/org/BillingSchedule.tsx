import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduleKey, useBillingSchedule } from "./useBillingSchedule";
import { Download, Loader2, Pencil, Plus, Receipt, Trash2, X } from "lucide-react";
import {
  addBillingPeriod,
  exportBillingSchedule,
  removeBillingPeriod,
  updateBillingPeriod,
  type BillingPeriod,
  type BillingSchedule as Schedule,
} from "@/api/billingSchedule";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ModalPortal } from "@/components/ModalPortal";
import { CardSkeleton } from "@/components/Skeletons";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { periodEnd } from "@/lib/billing";
import { fmtDate } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATUS: Record<BillingPeriod["status"], { label: string; style: string }> = {
  past: { label: "Past", style: "bg-navy/8 text-navy/60" },
  current: { label: "Current", style: "bg-blue/12 text-blue" },
  upcoming: { label: "Upcoming", style: "bg-amber/25 text-navy" },
};

const fieldLabel = "mb-1 block text-[11px] font-bold tracking-wide text-navy/55 uppercase";
const fieldInput =
  "min-h-11 w-full rounded-xl border border-navy/20 bg-card px-3 text-sm font-semibold outline-none focus:border-blue focus:ring-2 focus:ring-blue/25";

const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;

/**
 * An organisation's billing schedule: Billing 1, Billing 2, ... one after another, with the
 * contract's start, length and total. Its Admin and Super Admins share the same list.
 */
/**
 * The schedule at a glance for an organisation card: the running period, what's been billed and
 * until when it's paid. It shares its data with the full schedule, so changes show at once.
 */
export function BillingScheduleSummary({ orgId, onOpen }: { orgId: string; onOpen: () => void }) {
  const schedule = useBillingSchedule(orgId);
  const data = schedule.data;
  const periods = data?.periods ?? [];
  // The running period, else the next one to start, else the latest.
  const focus =
    periods.find((p) => p.status === "current") ??
    periods.find((p) => p.status === "upcoming") ??
    periods.at(-1);

  return (
    <div
      aria-label="Billing schedule summary"
      className="mt-2 rounded-2xl border border-navy/10 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
          <Receipt className="h-3.5 w-3.5" aria-hidden /> Billing schedule
        </p>
        {focus && <StatusBadge status={focus.status} />}
      </div>
      {schedule.isLoading ? (
        <p className="mt-2 text-xs text-navy/50">Loading…</p>
      ) : !data || periods.length === 0 ? (
        <p className="mt-2 text-xs text-navy/60">No billing periods yet.</p>
      ) : (
        <>
          {focus && (
            <>
              <p className="mt-2 text-lg leading-tight font-bold">
                {fmtMoney(focus.amount)}{" "}
                <span className="text-sm font-semibold text-navy/60">
                  · Billing {focus.sequence}
                </span>
              </p>
              <p className="text-xs text-navy/60">
                {fmtDate(focus.startsOn)} – {fmtDate(focus.endsOn)} · {months(focus.months)}
              </p>
            </>
          )}
          <p className="mt-1.5 text-xs text-navy/60">
            {periods.length} period{periods.length === 1 ? "" : "s"} · {fmtMoney(data.totalAmount)}{" "}
            over {months(data.totalMonths)}
            {data.endsOn ? ` · paid until ${fmtDate(data.endsOn)}` : ""}
          </p>
        </>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Billing schedule for ${data?.organisationName ?? "this organisation"}`}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-navy/15 text-xs font-bold hover:border-navy/35"
      >
        {periods.length ? "View billing schedule" : "Add Billing 1"}
      </button>
    </div>
  );
}

export function BillingSchedule({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const queryKey = scheduleKey(orgId);
  const schedule = useBillingSchedule(orgId);
  const [editing, setEditing] = useState<BillingPeriod | "new" | null>(null);
  const [view, setView] = useViewMode("billing-schedule");
  const [error, setError] = useState("");
  const saved = (next: Schedule) => queryClient.setQueryData(queryKey, next);
  const remove = useMutation({
    mutationFn: (period: BillingPeriod) => removeBillingPeriod(orgId, period.id),
    onSuccess: saved,
    onError: (failure: Error) => setError(failure.message),
  });
  const download = useMutation({
    mutationFn: () => exportBillingSchedule(orgId),
    onError: (failure: Error) => setError(failure.message),
  });

  if (schedule.isLoading) return <CardSkeleton />;
  if (schedule.isError || !schedule.data) {
    return (
      <p role="alert" className="text-sm font-semibold text-coral">
        Couldn't load the billing schedule. {schedule.error?.message}
      </p>
    );
  }
  const data = schedule.data;
  const nextNumber = data.periods.length + 1;
  const last = data.periods.at(-1);

  return (
    <section aria-label="Billing schedule">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Receipt className="h-5 w-5 text-coral" aria-hidden /> Billing schedule
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle mode={view} onChange={setView} />
          <button
            type="button"
            onClick={() => download.mutate()}
            disabled={download.isPending || data.periods.length === 0}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-navy/20 px-4 text-xs font-bold disabled:opacity-50"
          >
            {download.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            Export to Excel
          </button>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-coral px-4 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add Billing {nextNumber}
          </button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Start date" value={data.startsOn ? fmtDate(data.startsOn) : "Not set"} />
        <Stat label="Total months" value={months(data.totalMonths)} />
        <Stat label="Total billed" value={fmtMoney(data.totalAmount)} />
        <Stat
          label="Paid until"
          value={data.endsOn ? fmtDate(data.endsOn) : "—"}
          hint={data.currentSequence ? `Billing ${data.currentSequence} is running` : undefined}
        />
      </dl>

      {data.periods.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-navy/20 p-5 text-center text-sm text-navy/60">
          No billing periods yet. Add Billing 1 with its start date, length and price.
        </p>
      ) : view === "list" ? (
        <PeriodTable
          periods={data.periods}
          onEdit={setEditing}
          onRemove={(period) => remove.mutateAsync(period)}
        />
      ) : (
        <PeriodCards
          periods={data.periods}
          onEdit={setEditing}
          onRemove={(period) => remove.mutateAsync(period)}
        />
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-coral">
          {error}
        </p>
      )}
      {editing && (
        <PeriodDialog
          orgId={orgId}
          period={editing === "new" ? null : editing}
          sequence={editing === "new" ? nextNumber : editing.sequence}
          // A period starts the day after the one before it ends, or on any later date.
          earliest={editing === "new" ? (last ? data.nextStartsOn : null) : editing.earliestStart}
          previous={editing === "new" ? last?.sequence : editing.sequence - 1}
          startsOn={editing === "new" ? data.nextStartsOn : editing.startsOn}
          // A renewal repeats the last period; Billing 1 starts from the organisation's setup.
          defaults={last ?? data.suggested}
          onSaved={(next) => {
            saved(next);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function PeriodTable({
  periods,
  onEdit,
  onRemove,
}: {
  periods: BillingPeriod[];
  onEdit: (period: BillingPeriod) => void;
  onRemove: (period: BillingPeriod) => Promise<unknown>;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-navy/10">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="bg-navy/4 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
          <tr>
            <th className="px-3 py-2.5">Billing</th>
            <th className="px-3 py-2.5">Dates</th>
            <th className="px-3 py-2.5">Months</th>
            <th className="px-3 py-2.5">Licences</th>
            <th className="px-3 py-2.5">Per licence / month</th>
            <th className="px-3 py-2.5">Total</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/8">
          {periods.map((period) => (
            <tr
              key={period.id}
              aria-label={`Billing ${period.sequence}`}
              className={cn(period.status === "current" && "bg-blue/4")}
            >
              <td className="px-3 py-2.5 font-bold whitespace-nowrap">
                Billing {period.sequence}
                {period.note && (
                  <span className="block max-w-48 truncate text-[11px] font-semibold text-navy/55">
                    {period.note}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-navy/70">
                {fmtDate(period.startsOn)} – {fmtDate(period.endsOn)}
              </td>
              <td className="px-3 py-2.5">{period.months}</td>
              <td className="px-3 py-2.5">{period.licenses}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{fmtMoney(period.licensePrice)}</td>
              <td className="px-3 py-2.5 font-bold whitespace-nowrap">{fmtMoney(period.amount)}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={period.status} />
              </td>
              <td className="px-3 py-2.5">
                <PeriodActions
                  period={period}
                  onEdit={() => onEdit(period)}
                  onRemove={() => onRemove(period)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodCards({
  periods,
  onEdit,
  onRemove,
}: {
  periods: BillingPeriod[];
  onEdit: (period: BillingPeriod) => void;
  onRemove: (period: BillingPeriod) => Promise<unknown>;
}) {
  return (
    <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {periods.map((period) => (
        <li
          key={period.id}
          aria-label={`Billing ${period.sequence}`}
          className={cn(
            "rounded-2xl border p-4",
            period.status === "current" ? "border-blue/40 bg-blue/4" : "border-navy/10",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold">Billing {period.sequence}</p>
              <p className="text-xs font-semibold text-navy/60">
                {fmtDate(period.startsOn)} – {fmtDate(period.endsOn)}
              </p>
            </div>
            <StatusBadge status={period.status} />
          </div>
          <p className="mt-3 text-xl leading-tight font-bold">{fmtMoney(period.amount)}</p>
          <p className="text-xs text-navy/60">
            {months(period.months)} · {period.licenses} licence
            {period.licenses === 1 ? "" : "s"} × {fmtMoney(period.licensePrice)} a month
          </p>
          {period.note && <p className="mt-2 text-xs text-navy/70">{period.note}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-navy/50">
              Added{period.addedByName ? ` by ${period.addedByName}` : ""} on{" "}
              {fmtDate(period.createdAt)}
            </p>
            <PeriodActions
              period={period}
              onEdit={() => onEdit(period)}
              onRemove={() => onRemove(period)}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function StatusBadge({ status }: { status: BillingPeriod["status"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
        STATUS[status].style,
      )}
    >
      {STATUS[status].label}
    </span>
  );
}

function PeriodActions({
  period,
  onEdit,
  onRemove,
}: {
  period: BillingPeriod;
  onEdit: () => void;
  onRemove: () => Promise<unknown>;
}) {
  return (
    <div className="flex gap-1.5">
      {period.canEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit Billing ${period.sequence}`}
          className="grid h-9 w-9 place-items-center rounded-full bg-navy/6 hover:bg-navy/12"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
      )}
      {period.canRemove && (
        <ConfirmButton
          type="button"
          confirmationTitle={`Remove Billing ${period.sequence}?`}
          confirmationMessage={`${fmtDate(period.startsOn)} – ${fmtDate(period.endsOn)}, ${fmtMoney(period.amount)}. You can add it again afterwards.`}
          confirmLabel="Remove"
          onClick={onRemove}
          aria-label={`Remove Billing ${period.sequence}`}
          className="grid h-9 w-9 place-items-center rounded-full bg-coral/10 text-coral hover:bg-coral/20"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </ConfirmButton>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-2xl bg-navy/4 p-3">
      <dt className="text-[11px] font-bold tracking-wide text-navy/55 uppercase">{label}</dt>
      <dd className="mt-1 text-base font-bold">{value}</dd>
      {hint && <dd className="text-[11px] text-navy/55">{hint}</dd>}
    </div>
  );
}

function PeriodDialog({
  orgId,
  period,
  sequence,
  earliest,
  previous,
  startsOn,
  defaults,
  onSaved,
  onClose,
}: {
  orgId: string;
  period: BillingPeriod | null;
  sequence: number;
  earliest: string | null;
  previous: number | undefined;
  startsOn: string;
  defaults: { months: number; licenses: number; licensePrice: number };
  onSaved: (schedule: Schedule) => void;
  onClose: () => void;
}) {
  // A renewal starts from the last period's licences and price; only what changed needs typing.
  const base = period ?? defaults;
  const [start, setStart] = useState(startsOn);
  const [length, setLength] = useState(String(period?.months ?? (defaults.months || "")));
  const [licenses, setLicenses] = useState(String(base?.licenses ?? ""));
  const [price, setPrice] = useState(String(base?.licensePrice ?? ""));
  // An agreed total is kept; a calculated one follows the licences, price and months.
  const agreed =
    period &&
    Math.round(period.amount * 100) !==
      Math.round(period.licenses * period.licensePrice * period.months * 100);
  const [total, setTotal] = useState(agreed ? String(period.amount) : "");
  const [note, setNote] = useState(period?.note ?? "");
  const [error, setError] = useState("");

  const monthCount = Number(length);
  const licenceCount = Number(licenses || 0);
  const unitPrice = Number(price || 0);
  const calculated = Math.round(licenceCount * unitPrice * monthCount * 100) / 100;
  const amount = total.trim() === "" ? calculated : Number(total);
  const end = periodEnd(start, monthCount);

  const save = useMutation({
    mutationFn: () => {
      const input = {
        months: monthCount,
        licenses: licenceCount,
        licensePrice: unitPrice,
        amount,
        note,
        startsOn: start,
      };
      return period ? updateBillingPeriod(orgId, period.id, input) : addBillingPeriod(orgId, input);
    },
    onSuccess: onSaved,
    onError: (failure: Error) => setError(failure.message),
  });

  return (
    <Sheet
      title={`${period ? "Edit" : "Add"} Billing ${sequence}`}
      subtitle={
        earliest
          ? `Starts on ${fmtDate(earliest)}, the day after Billing ${previous} ends, or pick a later date.`
          : "The first period sets when the contract starts."
      }
      onClose={onClose}
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!start) return setError("Choose the start date.");
          if (earliest && start < earliest)
            return setError(
              `Billing ${sequence} can start on ${fmtDate(earliest)} at the earliest, after Billing ${previous} ends.`,
            );
          if (!Number.isInteger(monthCount) || monthCount < 1 || monthCount > 60)
            return setError("Months must be a whole number from 1 to 60.");
          if (!Number.isInteger(licenceCount) || licenceCount < 0)
            return setError("Licences must be a whole number.");
          if (!Number.isFinite(unitPrice) || unitPrice < 0)
            return setError("Enter a valid price per licence.");
          if (!Number.isFinite(amount) || amount < 0) return setError("Enter a valid total.");
          setError("");
          save.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={fieldLabel}>Start date</span>
            <input
              type="date"
              value={start}
              min={earliest ?? undefined}
              onChange={(e) => setStart(e.target.value)}
              className={fieldInput}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Duration (months)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className={fieldInput}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Licences (members)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={licenses}
              onChange={(e) => setLicenses(e.target.value)}
              className={fieldInput}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Price per licence per month (AED)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={fieldInput}
            />
          </label>
        </div>
        <label className="block">
          <span className={fieldLabel}>Total for the period (AED)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={total}
            placeholder={String(calculated)}
            onChange={(e) => setTotal(e.target.value)}
            className={fieldInput}
          />
          <span className="mt-1 block text-[11px] text-navy/55">
            Leave empty to use {licenceCount} × {fmtMoney(unitPrice)} × {monthCount || 0} months ={" "}
            {fmtMoney(calculated)}, or enter the amount agreed.
          </span>
        </label>
        <label className="block">
          <span className={fieldLabel}>Note (optional)</span>
          <input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Invoice number or what was agreed"
            className={fieldInput}
          />
        </label>
        {end && (
          <p
            aria-label="Period summary"
            className="rounded-2xl bg-navy/4 p-3 text-sm font-semibold"
          >
            {fmtDate(start)} – {fmtDate(end)} · {months(monthCount)} ·{" "}
            {fmtMoney(Number.isFinite(amount) ? amount : 0)}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-coral">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-navy/20 px-5 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-cream disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {period ? "Save changes" : `Add Billing ${sequence}`}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** A dialog: a sheet from the bottom on phones, centred on larger screens. */
export function Sheet({
  title,
  subtitle,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-end bg-navy/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl",
            wide ? "max-w-5xl" : "max-w-lg",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{title}</h2>
              {subtitle && <p className="text-xs text-navy/55">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/6 hover:bg-navy/12"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}
