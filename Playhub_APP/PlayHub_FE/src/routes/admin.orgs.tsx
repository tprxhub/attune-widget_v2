import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Mail, Pencil, Plus, Power } from "lucide-react";
import { createOrg, listOrgs, toggleOrgActive, updateOrgLicenses } from "@/api/admin";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { Select } from "@/components/Select";
import { CardSkeleton } from "@/components/Skeletons";
import { ViewToggle, useViewMode } from "@/components/ViewToggle";
import { useOrgScope } from "@/lib/org-scope";
import type { Org } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createOrg({ name: name.trim(), kind, licenses: Number(licenses), licensePrice: 9 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      setName("");
      setOpen(false);
    },
  });

  const toggle = useMutation({
    mutationFn: (orgId: string) => toggleOrgActive(orgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orgs"] }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
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
          className="ph-card mt-5 grid gap-4 p-5 sm:grid-cols-[1.4fr_0.8fr_0.6fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 3) {
              setError("Enter the organisation's name.");
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
            <label htmlFor="org-licenses" className="text-sm font-bold">
              Licenses
            </label>
            <input
              id="org-licenses"
              inputMode="numeric"
              value={licenses}
              onChange={(e) => setLicenses(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/25"
            />
          </div>
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
                {org.licensesUsed} / {org.licenses} licenses
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
              <button
                type="button"
                onClick={() => toggle.mutate(org.id)}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
              >
                <Power className="h-3.5 w-3.5" aria-hidden />{" "}
                {org.active ? "Suspend" : "Reactivate"}
              </button>
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

              <p className="mt-3 text-xs text-navy/60">
                {org.licensesUsed} / {org.licenses} licenses used · {org.billingCycle} billing
              </p>
              <LicenseEditor org={org} />

              <button
                type="button"
                onClick={() => toggle.mutate(org.id)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-navy/20 text-sm font-bold"
              >
                <Power className="h-4 w-4" aria-hidden /> {org.active ? "Suspend" : "Reactivate"}
              </button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/** Raise or lower an organisation's licence count without recreating it. */
function LicenseEditor({ org, compact = false }: { org: Org; compact?: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(org.licenses));
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => updateOrgLicenses(org.id, Number(value)),
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
          setEditing(true);
        }}
        aria-label={`Edit seat count for ${org.name}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full text-xs font-bold text-blue hover:underline",
          compact ? "shrink-0 px-2" : "mt-2",
        )}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden /> Change licenses
      </button>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) save.mutate();
      }}
      className={cn("flex flex-wrap items-center gap-2", compact ? "shrink-0" : "mt-2")}
    >
      <label className="sr-only" htmlFor={`licenses-${org.id}`}>
        Seat count for {org.name}
      </label>
      <input
        id={`licenses-${org.id}`}
        type="number"
        min={Math.max(1, org.licensesUsed)}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-9 w-24 rounded-xl border border-navy/20 bg-card px-3 text-sm font-semibold"
      />
      <button
        type="submit"
        disabled={invalid || save.isPending}
        className="min-h-9 rounded-full bg-blue px-4 text-xs font-bold text-white disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError("");
        }}
        className="min-h-9 rounded-full px-3 text-xs font-bold text-navy/65"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="basis-full text-xs font-semibold text-coral">
          {error}
        </p>
      )}
    </form>
  );
}
