import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listOrgs } from "@/api/admin";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { Select } from "@/components/Select";
import { BillingSchedule } from "@/features/org/BillingSchedule";
import { useOrgScope } from "@/lib/org-scope";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({ meta: [{ title: "Billing — Play Hub admin" }] }),
  component: () => (
    <Protected roles={["super_admin"]}>
      <AdminBilling />
    </Protected>
  ),
});

function AdminBilling() {
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: listOrgs });
  const { scopeId } = useOrgScope();
  const [selectedId, setSelectedId] = useState("");
  const organisations = (orgs.data ?? []).filter(
    (org) => scopeId === "all" || scopeId === "b2b" || org.id === scopeId,
  );
  const selected = organisations.find((org) => org.id === selectedId) ?? organisations[0];

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Billing"
        description="View and manage each organisation's billing periods, licences and payments."
      />
      <section className="ph-card mt-5 p-4 sm:p-5">
        {orgs.isPending ? (
          <p className="text-sm text-navy/60">Loading organisations…</p>
        ) : orgs.isError ? (
          <p role="alert" className="text-sm text-coral">
            Could not load organisations. Please try again.
          </p>
        ) : selected ? (
          <>
            <label className="mb-5 block max-w-md text-sm font-bold">
              Organisation
              <Select
                aria-label="Organisation"
                value={selected.id}
                onChange={setSelectedId}
                options={organisations.map((org) => ({ value: org.id, label: org.name }))}
                className="mt-2"
              />
            </label>
            <BillingSchedule key={selected.id} orgId={selected.id} />
          </>
        ) : (
          <p className="text-sm text-navy/60">No organisations in this scope.</p>
        )}
      </section>
    </>
  );
}
