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
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  createOrg,
  deleteOrg,
  getOrgDeletionPreview,
  listOrgs,
  recordOrgRenewal,
  toggleOrgActive,
  updateOrg,
} from "@/api/admin";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PreviewedDeleteDialog } from "@/components/DeleteConfirmDialog";
import { ModalPortal } from "@/components/ModalPortal";
import { PageHeader } from "@/components/AppShell";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { useOrgScope } from "@/lib/org-scope";
import type { LicenseType, Org } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { cycleLabel, cycleUnit, monthsFromToday, monthsUntil } from "@/lib/billing";
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
  { value: "children", label: "Member licences", description: "Each active member uses one" },
  {
    value: "moderators",
    label: "Moderator licences",
    description: "Each Moderator, active or invited, uses one",
  },
];

/** "12 / 25 member licences", or "4 Moderators · no limit" when the count is 0. */
function licenseSummary(org: Pick<Org, "licenses" | "licensesUsed" | "licenseType">) {
  const noun = org.licenseType === "moderators" ? "Moderator" : "member";
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
  const { session } = useSession();
  // Deleting an organisation is permanent: only a Super Admin sees the option, and only once the
  // organisation is suspended.
  const canDelete = session.role === "super_admin";
  const [deleting, setDeleting] = useState<Org | null>(null);
  const [editing, setEditing] = useState<Org | null>(null);
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
              {licenseType === "moderators" ? "Moderator licences" : "Member licences"}
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
              Price per licence per month (AED)
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
              ? billingCycle === "Monthly"
                ? `${fmtMoney(Number(price) * Number(licenses))} per month · first renewal one month from today`
                : `${fmtMoney(Number(price) * Number(licenses) * 12)} per year (12 months) · first renewal one year from today`
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
              <button
                type="button"
                onClick={() => setEditing(org)}
                aria-label={`Edit ${org.name}`}
                className="inline-flex shrink-0 items-center gap-1.5 px-2 text-xs font-bold text-blue hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </button>
              <ConfirmButton
                confirmationTitle={`Suspend ${org.name}?`}
                confirmationMessage="Staff and members will lose access until this organisation is reactivated."
                confirmLabel="Suspend organisation"
                requireConfirmation={org.active}
                type="button"
                onClick={() => (org.active ? toggle.mutateAsync(org.id) : toggle.mutate(org.id))}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
              >
                <Power className="h-3.5 w-3.5" aria-hidden />{" "}
                {org.active ? "Suspend" : "Reactivate"}
              </ConfirmButton>
              {canDelete && !org.active && (
                <button
                  type="button"
                  onClick={() => setDeleting(org)}
                  aria-label={`Delete ${org.name}`}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-coral/25 px-4 text-xs font-bold text-coral hover:border-coral"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </button>
              )}
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
              <button
                type="button"
                onClick={() => setEditing(org)}
                aria-label={`Edit ${org.name}`}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </button>

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
                  ? "Licensed by Moderator: each active or invited Moderator uses a licence. Members are unlimited."
                  : "Licensed by member: each active member uses a licence. Moderators are unlimited."}
              </p>
              <BillingPanel org={org} />

              <ConfirmButton
                confirmationTitle={`Suspend ${org.name}?`}
                confirmationMessage="Staff and members will lose access until this organisation is reactivated."
                confirmLabel="Suspend organisation"
                requireConfirmation={org.active}
                type="button"
                onClick={() => (org.active ? toggle.mutateAsync(org.id) : toggle.mutate(org.id))}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-navy/20 text-sm font-bold"
              >
                <Power className="h-4 w-4" aria-hidden /> {org.active ? "Suspend" : "Reactivate"}
              </ConfirmButton>
              {canDelete && !org.active && (
                <button
                  type="button"
                  onClick={() => setDeleting(org)}
                  aria-label={`Delete ${org.name}`}
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-coral hover:bg-coral/8"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete organisation
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {deleting && <DeleteOrgDialog org={deleting} onClose={() => setDeleting(null)} />}
      {editing && <EditOrgDialog org={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Super Admin: see everything that goes with an organisation, type its name, then delete it all. */
function DeleteOrgDialog({ org, onClose }: { org: Org; onClose: () => void }) {
  return (
    <PreviewedDeleteDialog
      queryKey={["org-deletion-preview", org.id]}
      loadPreview={() => getOrgDeletionPreview(org.id)}
      remove={(typed) => deleteOrg(org.id, typed)}
      rows={(counts) => [
        ["Admins", counts.admins],
        ["Moderators", counts.moderators],
        ["Member accounts", counts.members],
        ["Members", counts.children],
        ["Sessions logged", counts.sessions],
        ["Subscriptions", counts.subscriptions],
        ["Attune chats", counts.attune_conversations],
        ["Invitations", counts.invitations],
      ]}
      description={() => (
        <p>
          This permanently deletes the organisation, everyone in it and every member&apos;s data. It
          cannot be undone. Play Plans and the audit log are kept.
        </p>
      )}
      title={`Delete ${org.name}?`}
      confirmText={org.name}
      deleteLabel="Delete everything"
      onClose={onClose}
    />
  );
}

const fieldLabel = "mb-1 block text-[11px] font-bold tracking-wide text-navy/55 uppercase";
const fieldInput =
  "min-h-11 w-full rounded-xl border border-navy/20 bg-card px-3 text-sm font-semibold outline-none focus:border-blue focus:ring-2 focus:ring-blue/25";

/** The billing sum written out: licences × monthly price per licence × months in the cycle. */
function BillingBreakdown({
  count,
  noun,
  price,
  months,
  renewsOn,
}: {
  count: number;
  noun: string;
  price: number;
  months: number;
  renewsOn: string;
}) {
  if (!(count > 0) || !(price > 0)) {
    return (
      <p className="text-xs text-navy/60 sm:col-span-2">
        Enter the number of licences and the monthly price per licence to see what the organisation
        pays.
      </p>
    );
  }
  const perMonth = Math.round(count * price * 100) / 100;
  const perCycle = Math.round(perMonth * months * 100) / 100;
  const perYear = Math.round(perMonth * 12 * 100) / 100;
  const line = "flex flex-wrap justify-between gap-x-3 text-navy/70";
  return (
    <div
      aria-label="Billing calculation"
      className="grid gap-1 rounded-xl bg-navy/4 p-3 text-sm sm:col-span-2"
    >
      <p className={line}>
        <span>
          {count} {noun} licence{count === 1 ? "" : "s"} × {fmtMoney(price)} a month
        </span>
        <span className={months === 1 ? "font-bold text-navy" : ""}>
          = {fmtMoney(perMonth)} per month
        </span>
      </p>
      {months !== 1 && (
        <p className={line}>
          <span>
            {fmtMoney(perMonth)} × {months} months
          </span>
          <span className="font-bold text-navy">
            = {fmtMoney(perCycle)} per {cycleUnit(months)}
          </span>
        </p>
      )}
      {months !== 12 && (
        <p className={line}>
          <span>{fmtMoney(perMonth)} × 12 months</span>
          <span>= {fmtMoney(perYear)} per year</span>
        </p>
      )}
      <p className="text-xs text-navy/55">
        Billed every {cycleUnit(months)}: {fmtMoney(perCycle)}
        {renewsOn ? `, next payment due on ${fmtDate(renewsOn)}.` : "."}
      </p>
    </div>
  );
}

/** Every detail of an organisation in one form: name, type, licences and billing. */
function EditOrgDialog({ org, onClose }: { org: Org; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(org.name);
  const [kind, setKind] = useState<"School" | "Clinic">(
    org.kind === "Clinic" ? "Clinic" : "School",
  );
  const [licenseType, setLicenseType] = useState<LicenseType>(org.licenseType);
  const [licenses, setLicenses] = useState(String(org.licenses));
  const [months, setMonths] = useState(org.billingMonths);
  const [price, setPrice] = useState(String(org.licensePrice || ""));
  const [renewsOn, setRenewsOn] = useState(org.renewsOn ?? "");
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () =>
      updateOrg(org.id, {
        name: name.trim(),
        kind,
        licenses: Number(licenses),
        licenseType,
        billingMonths: months,
        licensePrice: Number(price || 0),
        renewsOn: renewsOn || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orgs"] });
      onClose();
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const count = Number(licenses);
  const cost = Number(price || 0);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-end bg-navy/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${org.name}`}
          className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Edit organisation</h2>
              <p className="truncate text-xs text-navy/55">{org.name}</p>
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
          <form
            className="mt-4 grid gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim().length < 2) return setError("Enter the organisation's name.");
              if (!Number.isInteger(count) || count < 1)
                return setError("Licences must be 1 or more.");
              if (!Number.isFinite(cost) || cost < 0)
                return setError("Enter a valid price per licence.");
              setError("");
              save.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <label className="block min-w-0">
                <span className={fieldLabel}>Organisation name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldInput}
                />
              </label>
              <div className="min-w-0">
                <span className={fieldLabel}>Type</span>
                <Select
                  aria-label="Organisation type"
                  value={kind}
                  onChange={(next) => setKind(next as "School" | "Clinic")}
                  options={[
                    { value: "School", label: "School" },
                    { value: "Clinic", label: "Clinic" },
                  ]}
                />
              </div>
            </div>
            <fieldset className="grid gap-3 rounded-2xl border border-navy/10 p-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <legend className="px-1 text-xs font-bold">Licences</legend>
              <div className="min-w-0">
                <span className={fieldLabel}>Licence type</span>
                <Select
                  aria-label="Licence type"
                  value={licenseType}
                  onChange={(next) => setLicenseType(next as LicenseType)}
                  options={LICENSE_OPTIONS}
                />
              </div>
              <label className="block min-w-0">
                <span className={fieldLabel}>Number of licences</span>
                <input
                  type="number"
                  min={1}
                  value={licenses}
                  onChange={(e) => setLicenses(e.target.value)}
                  className={fieldInput}
                />
              </label>
              {licenseType !== org.licenseType && (
                <p className="text-xs text-navy/60 sm:col-span-2">
                  {licenseType === "moderators"
                    ? "Members will no longer use licences; each active or invited Moderator will."
                    : "Moderators will no longer use licences; each active member will."}
                </p>
              )}
            </fieldset>
            <fieldset className="grid gap-3 rounded-2xl border border-navy/10 p-3 sm:grid-cols-2">
              <legend className="px-1 text-xs font-bold">Billing</legend>
              <div className="min-w-0">
                <span className={fieldLabel}>Billing cycle</span>
                <Select
                  aria-label="Billing cycle"
                  value={String(months)}
                  onChange={(next) => {
                    // A new cycle starts today: the next renewal is one cycle away.
                    setMonths(Number(next));
                    setRenewsOn(monthsFromToday(Number(next)));
                  }}
                  options={[
                    { value: "1", label: "Monthly" },
                    { value: "12", label: "Annual" },
                    // A renewal date set by hand gives a custom period, e.g. 10 months.
                    ...(months !== 1 && months !== 12
                      ? [{ value: String(months), label: cycleLabel(months) }]
                      : []),
                  ]}
                />
              </div>
              <label className="block min-w-0">
                <span className={fieldLabel}>Price per licence per month (AED)</span>
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={fieldInput}
                />
              </label>
              <label className="block min-w-0 sm:col-span-2">
                <span className={fieldLabel}>Next renewal</span>
                <input
                  type="date"
                  value={renewsOn}
                  onChange={(e) => {
                    setRenewsOn(e.target.value);
                    // The cycle follows the date: 10 months away bills every 10 months.
                    const until = monthsUntil(e.target.value);
                    if (until !== null && until <= 60) setMonths(until);
                  }}
                  className={fieldInput}
                />
              </label>
              <BillingBreakdown
                count={count}
                noun={licenseType === "moderators" ? "Moderator" : "member"}
                price={cost}
                months={months}
                renewsOn={renewsOn}
              />
            </fieldset>
            {error && (
              <p role="alert" className="text-sm font-semibold text-coral">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Save changes
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

/** What the organisation pays, when it renews, and the actions to record a renewal or change billing. */
function BillingPanel({ org }: { org: Org }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["orgs"] });
  const renew = useMutation({
    mutationFn: () => recordOrgRenewal(org.id),
    onSuccess: refresh,
    onError: (failure: Error) => setError(failure.message),
  });
  const unit = cycleUnit(org.billingMonths);
  const noun = org.licenseType === "moderators" ? "Moderator" : "member";

  return (
    <div className="mt-3 rounded-2xl border border-navy/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
          <Receipt className="h-3.5 w-3.5" aria-hidden />{" "}
          {org.billingMonths === 1
            ? "Monthly"
            : org.billingMonths === 12
              ? "Annual"
              : `${org.billingMonths}-month`}{" "}
          billing
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
            {fmtMoney(org.licensePrice)} a month
            {org.billingMonths === 1
              ? ` · ${fmtMoney(org.annualValue)} a year`
              : ` × ${org.billingMonths} months`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-navy/60">No price per licence set yet.</p>
      )}

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
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
