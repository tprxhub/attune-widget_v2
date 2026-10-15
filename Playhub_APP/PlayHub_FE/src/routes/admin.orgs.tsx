import { ConfirmButton } from "@/components/ConfirmButton";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Power,
  Receipt,
} from "lucide-react";
import {
  createOrg,
  listOrgs,
  recordOrgRenewal,
  toggleOrgActive,
  updateOrgBilling,
  updateOrgLicenses,
} from "@/api/admin";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { useOrgScope } from "@/lib/org-scope";
import type { LicenseType, Org } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const CYCLE_OPTIONS = [
  { value: "Monthly", label: "Monthly", description: "Invoiced every month" },
  { value: "Annual", label: "Annual", description: "Invoiced once a year" },
];

const RENEWAL_STYLE: Record<Org["renewalStatus"], string> = {
  active: "bg-blue/10 text-blue",
  due_soon: "bg-amber/25 text-[#8a5a07]",
  overdue: "bg-coral/12 text-coral",
  none: "bg-navy/6 text-navy/60",
};

function renewalLabel(org: Org) {
  if (!org.renewsOn) return "No renewal date";
  const when = fmtDate(org.renewsOn);
  if (org.renewalStatus === "overdue") return `Renewal overdue since ${when}`;
  if (org.renewalStatus === "due_soon") return `Renewal due ${when}`;
  return `Renews ${when}`;
}

const LICENSE_OPTIONS = [
  { value: "children", label: "Child licences", description: "Each active child uses one" },
  {
    value: "moderators",
    label: "Moderator licences",
    description: "Each Moderator, active or invited, uses one",
  },
];

/** "12 / 25 child licences", or "4 Moderators · no limit" when the count is 0. */
function licenseSummary(org: Pick<Org, "licenses" | "licensesUsed" | "licenseType">) {
  const noun = org.licenseType === "moderators" ? "Moderator" : "child";
  if (!org.licenses) {
    const counted = org.licenseType === "moderators" ? "Moderators" : "children";
    return `${org.licensesUsed} ${counted} · no limit`;
  }
  return `${org.licensesUsed} / ${org.licenses} ${noun} licence${org.licenses === 1 ? "" : "s"}`;
}

export const Route = createFileRoute("/admin/orgs")({
  head: () => ({
    meta: [
      { title: "Organisations — Play Hub admin" },
      {
        name: "description",
        content:
          "Create schools and clinics, generate their login credentials and set license counts.",
      },
      { property: "og:title", content: "Organisations — Play Hub admin" },
      {
        property: "og:description",
        content: "Create organisations and generate their login credentials.",
      },
    ],
  }),
  component: () => (
    <Protected roles={["super_admin", "ttp_employee"]} permission="organisations">
      <AdminOrgs />
    </Protected>
  ),
});

function AdminOrgs() {
  const queryClient = useQueryClient();
  const orgsQuery = useQuery({ queryKey: ["orgs"], queryFn: listOrgs });
  const { scopeId } = useOrgScope();
  const isIndividualScope = scopeId === "individual" || scopeId.startsWith("subscriber:");
  const orgs = {
    ...orgsQuery,
    data:
      scopeId === "all" || scopeId === "b2b"
        ? orgsQuery.data
        : isIndividualScope
          ? []
          : (orgsQuery.data ?? []).filter((o) => o.id === scopeId),
  };
  const [open, setOpen] = useState(false);
  const [view, setView] = useViewMode("admin-orgs");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"School" | "Clinic">("School");
  const [licenses, setLicenses] = useState("25");
  const [licenseType, setLicenseType] = useState<LicenseType>("children");
  const [billingCycle, setBillingCycle] = useState<"Monthly" | "Annual">("Annual");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createOrg({
        name: name.trim(),
        kind,
        licenses: Number(licenses),
        licenseType,
        billingCycle,
        licensePrice: Number(price || 0),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      setName("");
      setPrice("");
      setOpen(false);
    },
    onError: (failure: Error) => setError(failure.message),
  });

  const toggle = useMutation({
    mutationFn: (orgId: string) => toggleOrgActive(orgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orgs"] }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Organisations"
        description={
          isIndividualScope
            ? "Individual subscribers do not belong to an organisation."
            : "Schools and clinics can't sign themselves up — every account starts here."
        }
        actions={
          !isIndividualScope ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" aria-hidden /> New organisation
            </button>
          ) : undefined
        }
      />

      {open && (
        <form
          className="ph-card mt-5 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 3) {
              setError("Enter the organisation's name.");
              return;
            }
            const count = Number(licenses);
            if (!Number.isInteger(count) || count < 1) {
              setError("Enter how many licences this organisation gets (1 or more).");
              return;
            }
            const perLicence = Number(price || 0);
            if (!Number.isFinite(perLicence) || perLicence < 0 || perLicence > 100000) {
              setError("Enter a price per licence in AED, or leave it empty.");
              return;
            }
            setError("");
            create.mutate();
          }}
        >
          <div>
            <label htmlFor="org-name" className="text-sm font-bold">
              Name
            </label>
            <input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
            />
            {error && <p className="mt-1.5 text-xs font-semibold text-coral">{error}</p>}
          </div>
          <div>
            <label htmlFor="org-kind" className="text-sm font-bold">
              Type
            </label>
            <Select
              id="org-kind"
              value={kind}
              onChange={(nextKind) => setKind(nextKind as "School" | "Clinic")}
              options={[
                { value: "School", label: "School" },
                { value: "Clinic", label: "Clinic" },
              ]}
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="org-license-type" className="text-sm font-bold">
              Licence type
            </label>
            <Select
              id="org-license-type"
              aria-label="Licence type"
              value={licenseType}
              onChange={(next) => setLicenseType(next as LicenseType)}
              options={LICENSE_OPTIONS}
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="org-licenses" className="text-sm font-bold">
              {licenseType === "moderators" ? "Moderator licences" : "Child licences"}
            </label>
            <input
              id="org-licenses"
              inputMode="numeric"
              value={licenses}
              onChange={(e) => setLicenses(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
            />
          </div>
          <div>
            <label htmlFor="org-cycle" className="text-sm font-bold">
              Billing cycle
            </label>
            <Select
              id="org-cycle"
              aria-label="Billing cycle"
              value={billingCycle}
              onChange={(next) => setBillingCycle(next as "Monthly" | "Annual")}
              options={CYCLE_OPTIONS}
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="org-price" className="text-sm font-bold">
              Price per licence (AED)
            </label>
            <input
              id="org-price"
              inputMode="decimal"
              placeholder="e.g. 9"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
            />
          </div>
          <p className="self-center text-xs text-navy/60 sm:col-span-2 lg:col-span-1">
            {Number(price) > 0 && Number(licenses) > 0
              ? `${fmtMoney(Number(price) * Number(licenses))} per ${billingCycle === "Monthly" ? "month" : "year"} · first renewal one ${billingCycle === "Monthly" ? "month" : "year"} from today`
              : "Billing starts today; the first renewal is one cycle later."}
          </p>
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Create
          </button>
        </form>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold tracking-[0.14em] text-navy/45 uppercase">
          {(orgs.data ?? []).length} organisation{(orgs.data ?? []).length === 1 ? "" : "s"}
        </p>
        <ViewToggle mode={view} onChange={setView} />
      </div>

      {orgs.isLoading ? (
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : view === "list" ? (
        <ul className="ph-card mt-3 divide-y divide-navy/8 p-0">
          {(orgs.data ?? []).map((org) => (
            <li key={org.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-navy/6 text-navy">
                <Building2 className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{org.name}</span>
                <span className="block text-xs text-navy/55">{org.kind}</span>
              </span>
              <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-navy/60 lg:block">
                Email invitation sign-in
              </span>
              <span className="shrink-0 rounded-full bg-navy/6 px-2.5 py-1 text-[11px] font-bold text-navy/70">
                {licenseSummary(org)}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                  RENEWAL_STYLE[org.renewalStatus],
                )}
              >
                {renewalLabel(org)}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                  org.active ? "bg-blue/12 text-blue" : "bg-coral/12 text-coral",
                )}
              >
                {org.active ? "Active" : "Suspended"}
              </span>
              <LicenseEditor org={org} compact />
              <ConfirmButton
                confirmationTitle={`Suspend ${org.name}?`}
                confirmationMessage="Staff and children will lose access until this organisation is reactivated."
                confirmLabel="Suspend organisation"
                requireConfirmation={org.active}
                type="button"
                onClick={() => (org.active ? toggle.mutateAsync(org.id) : toggle.mutate(org.id))}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
              >
                <Power className="h-3.5 w-3.5" aria-hidden />{" "}
                {org.active ? "Suspend" : "Reactivate"}
              </ConfirmButton>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(orgs.data ?? []).map((org) => (
            <article key={org.id} className="ph-card ph-rise p-5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-navy/6 text-navy">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold">{org.name}</span>
                  <span className="block text-xs text-navy/55">{org.kind}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                    org.active ? "bg-blue/12 text-blue" : "bg-coral/12 text-coral",
                  )}
                >
                  {org.active ? "Active" : "Suspended"}
                </span>
              </div>

              <div className="mt-4 rounded-2xl bg-navy/4 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
                  <Mail className="h-3.5 w-3.5" aria-hidden /> Secure access
                </p>
                <p className="mt-1.5 text-xs text-navy/70">
                  Invite each Admin or Moderator by email. They choose their own password.
                </p>
              </div>

              <p className="mt-3 text-xs text-navy/60">{licenseSummary(org)}</p>
              <p className="mt-1 text-[11px] text-navy/50">
                {org.licenseType === "moderators"
                  ? "Licensed by Moderator: each active or invited Moderator uses a licence. Children are unlimited."
                  : "Licensed by child: each active child uses a licence. Moderators are unlimited."}
              </p>
              <LicenseEditor org={org} />
              <BillingPanel org={org} />

              <ConfirmButton
                confirmationTitle={`Suspend ${org.name}?`}
                confirmationMessage="Staff and children will lose access until this organisation is reactivated."
                confirmLabel="Suspend organisation"
                requireConfirmation={org.active}
                type="button"
                onClick={() => (org.active ? toggle.mutateAsync(org.id) : toggle.mutate(org.id))}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-navy/20 text-sm font-bold"
              >
                <Power className="h-4 w-4" aria-hidden /> {org.active ? "Suspend" : "Reactivate"}
              </ConfirmButton>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/** Change an organisation's licence type (children or Moderators) and count. */
function LicenseEditor({ org, compact = false }: { org: Org; compact?: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(org.licenses));
  const [type, setType] = useState<LicenseType>(org.licenseType);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => updateOrgLicenses(org.id, Number(value), type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      setEditing(false);
      setError("");
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const parsed = Number(value);
  const invalid = !Number.isInteger(parsed) || parsed < 1;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(org.licenses));
          setType(org.licenseType);
          setError("");
          setEditing(true);
        }}
        aria-label={`Change licences for ${org.name}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full text-xs font-bold text-blue hover:underline",
          compact ? "shrink-0 px-2" : "mt-2",
        )}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden /> Change licences
      </button>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) save.mutate();
      }}
      className={cn(
        "grid gap-2 rounded-2xl border border-navy/10 bg-card p-3",
        compact ? "w-full basis-full sm:grid-cols-[minmax(0,1fr)_7rem_auto]" : "mt-2",
      )}
    >
      <div className="min-w-0">
        <span className="mb-1 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
          Licence type
        </span>
        <Select
          aria-label={`Licence type for ${org.name}`}
          value={type}
          onChange={(next) => setType(next as LicenseType)}
          options={LICENSE_OPTIONS}
        />
      </div>
      <label className="block min-w-0">
        <span className="mb-1 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
          {type === "moderators" ? "Moderator licences" : "Child licences"}
        </span>
        <input
          id={`licenses-${org.id}`}
          type="number"
          min={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={`Number of licences for ${org.name}`}
          className="min-h-11 w-full rounded-xl border border-navy/20 bg-card px-3 text-sm font-semibold"
        />
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={invalid || save.isPending}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-blue px-4 text-xs font-bold text-white disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
          }}
          className="min-h-11 rounded-full px-3 text-xs font-bold text-navy/65"
        >
          Cancel
        </button>
      </div>
      {type !== org.licenseType && (
        <p className="text-xs text-navy/60 sm:col-span-full">
          {type === "moderators"
            ? "Children will no longer use licences; each active or invited Moderator will."
            : "Moderators will no longer use licences; each active child will."}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-coral sm:col-span-full">
          {error}
        </p>
      )}
    </form>
  );
}

/** What the organisation pays, when it renews, and the actions to record a renewal or change billing. */
function BillingPanel({ org }: { org: Org }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [cycle, setCycle] = useState(org.billingCycle);
  const [price, setPrice] = useState(String(org.licensePrice || ""));
  const [renewsOn, setRenewsOn] = useState(org.renewsOn ?? "");
  const [error, setError] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["orgs"] });
  const renew = useMutation({
    mutationFn: () => recordOrgRenewal(org.id),
    onSuccess: refresh,
    onError: (failure: Error) => setError(failure.message),
  });
  const save = useMutation({
    mutationFn: () =>
      updateOrgBilling(org.id, {
        billingCycle: cycle,
        licensePrice: Number(price || 0),
        renewsOn: renewsOn || null,
      }),
    onSuccess: () => {
      refresh();
      setEditing(false);
      setError("");
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const unit = org.billingCycle === "Monthly" ? "month" : "year";
  const noun = org.licenseType === "moderators" ? "Moderator" : "child";
  const priceValid = Number.isFinite(Number(price || 0)) && Number(price || 0) >= 0;

  return (
    <div className="mt-3 rounded-2xl border border-navy/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
          <Receipt className="h-3.5 w-3.5" aria-hidden /> {org.billingCycle} billing
        </p>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold",
            RENEWAL_STYLE[org.renewalStatus],
          )}
        >
          {renewalLabel(org)}
        </span>
      </div>
      {org.licensePrice > 0 ? (
        <>
          <p className="mt-2 text-lg leading-tight font-bold">
            {fmtMoney(org.amountPerCycle)}{" "}
            <span className="text-sm font-semibold text-navy/60">/ {unit}</span>
          </p>
          <p className="text-xs text-navy/60">
            {org.licenses} {noun} licence{org.licenses === 1 ? "" : "s"} ×{" "}
            {fmtMoney(org.licensePrice)}
            {org.billingCycle === "Monthly" ? ` · ${fmtMoney(org.annualValue)} a year` : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-navy/60">No price per licence set yet.</p>
      )}

      {editing ? (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (priceValid) save.mutate();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="min-w-0">
              <span className="mb-1 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
                Cycle
              </span>
              <Select
                aria-label={`Billing cycle for ${org.name}`}
                value={cycle}
                onChange={(next) => setCycle(next as "Monthly" | "Annual")}
                options={CYCLE_OPTIONS}
              />
            </div>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
                AED per licence
              </span>
              <input
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                aria-label={`Price per licence for ${org.name}`}
                className="min-h-11 w-full rounded-xl border border-navy/20 bg-card px-3 text-sm font-semibold"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold tracking-wide text-navy/55 uppercase">
              Next renewal
            </span>
            <input
              type="date"
              value={renewsOn}
              onChange={(event) => setRenewsOn(event.target.value)}
              aria-label={`Next renewal for ${org.name}`}
              className="min-h-11 w-full rounded-xl border border-navy/20 bg-card px-3 text-sm font-semibold"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!priceValid || save.isPending}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Save billing
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              className="min-h-10 rounded-full px-3 text-xs font-bold text-navy/65"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <ConfirmButton
            confirmationTitle={`Record a renewal for ${org.name}?`}
            confirmationMessage={`Use this once ${org.name} has paid for another ${unit}${
              org.licensePrice > 0 ? ` (${fmtMoney(org.amountPerCycle)})` : ""
            }. The renewal date moves on by one ${unit}.`}
            confirmLabel="Record renewal"
            type="button"
            onClick={() => renew.mutateAsync()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-navy px-4 text-xs font-bold text-cream disabled:opacity-60"
          >
            {renew.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            )}
            Record renewal
          </ConfirmButton>
          <button
            type="button"
            onClick={() => {
              setCycle(org.billingCycle);
              setPrice(String(org.licensePrice || ""));
              setRenewsOn(org.renewsOn ?? "");
              setError("");
              setEditing(true);
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-blue hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit billing
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
