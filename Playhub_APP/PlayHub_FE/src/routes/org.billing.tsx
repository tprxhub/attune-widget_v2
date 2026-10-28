import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { BillingSchedule } from "@/features/org/BillingSchedule";

export const Route = createFileRoute("/org/billing")({
  // Opened from the Account page: offer the way back there.
  validateSearch: (search: Record<string, unknown>): { from?: "account" } =>
    search["from"] === "account" ? { from: "account" } : {},
  head: () => ({
    meta: [
      { title: "Billing — Play Hub for schools & clinics" },
      {
        name: "description",
        content: "Your organisation's billing periods: dates, licences and what each one costs.",
      },
    ],
  }),
  component: () => (
    <Protected roles={["educator"]} accountTypes={["b2b"]}>
      <OrgBilling />
    </Protected>
  ),
});

function OrgBilling() {
  const { session } = useSession();
  const { from } = Route.useSearch();
  return (
    <>
      {from === "account" && (
        <Link
          to="/account"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-navy/65 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Account
        </Link>
      )}
      <PageHeader
        eyebrow="Organisation"
        title="Billing"
        description="Each billing period follows the last. Add the next one when you renew; The Toy Pharmacy sees the same schedule."
      />
      <div className="ph-card mt-5 p-4 sm:p-5">
        {session.orgId ? (
          <BillingSchedule orgId={session.orgId} />
        ) : (
          <p className="text-sm text-navy/60">Your account isn't linked to an organisation.</p>
        )}
      </div>
    </>
  );
}
