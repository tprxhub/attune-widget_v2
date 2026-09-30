import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, GraduationCap, Users } from "lucide-react";
import { platformOverview } from "@/api/admin";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { useOrgScope } from "@/lib/org-scope";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Platform overview — Play Hub admin" },
      {
        name: "description",
        content:
          "Organisations, Admins, members and session volume across the whole Play Hub platform.",
      },
      { property: "og:title", content: "Platform overview — Play Hub admin" },
      {
        property: "og:description",
        content: "Organisations, Admins and session volume across Play Hub.",
      },
    ],
  }),
  component: () => (
    <Protected roles={["super_admin"]}>
      <AdminOverview />
    </Protected>
  ),
});

function AdminOverview() {
  const { scopeId, label, setScope } = useOrgScope();
  const overview = useQuery({
    queryKey: ["admin-overview", scopeId],
    queryFn: () => platformOverview(scopeId),
  });
  const allOverview = useQuery({
    queryKey: ["admin-overview", "all"],
    queryFn: () => platformOverview("all"),
  });

  if (overview.isLoading || allOverview.isLoading || !overview.data || !allOverview.data) {
    return (
      <>
        <PageHeader eyebrow="Super Admin" title="Platform overview" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} lines={2} />
          ))}
        </div>
      </>
    );
  }

  const o = overview.data;
  const all = allOverview.data;
  const tiles = [
    {
      label: "Organisations",
      value: `${o.activeOrgs} / ${o.orgs}`,
      hint: "active / total",
      icon: Building2,
    },
    {
      label: "Admins",
      value: String(o.educators),
      hint: `${o.supporters} moderators`,
      icon: GraduationCap,
    },
    {
      label: "Children",
      value: String(o.childrenTotal),
      hint: `${o.b2cChildren} individual · ${o.b2bChildren} organisation`,
      icon: Users,
    },
    {
      label: "Sessions (30d)",
      value: String(o.attemptsLast30),
      hint: `${o.totalAttempts} all time`,
      icon: Activity,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Platform overview"
        description={
          scopeId === "all"
            ? "Everything running on Play Hub, across families and organisations."
            : `Showing ${label} only — change the filter in the top bar.`
        }
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="ph-card ph-rise p-5">
            <span className="inline-grid h-10 w-10 place-items-center rounded-2xl bg-blue/12 text-blue">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
              {label}
            </p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-navy/55">{hint}</p>
          </div>
        ))}
      </div>

      <section className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="ph-card p-5">
          <p className="eyebrow text-blue">Organisation accounts</p>
          <h2 className="mt-1 text-lg font-bold">Organisations</h2>
          <p className="mt-2 text-sm text-navy/70">
            {all.activeOrgs} active of {all.orgs} organisations · {all.b2bChildren} children ·{" "}
            {all.educators} Admins. Organisation accounts are billed by license.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScope("b2b")}
              className="inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-bold text-white"
            >
              View organisation data
            </button>
            <Link
              to="/admin/orgs"
              onClick={() => setScope("b2b")}
              className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
            >
              Manage organisations
            </Link>
          </div>
        </section>
        <section className="ph-card p-5">
          <p className="eyebrow text-coral">Individual accounts</p>
          <h2 className="mt-1 text-lg font-bold">Individual subscribers</h2>
          <p className="mt-2 text-sm text-navy/70">
            {all.b2cChildren} individual children · {all.activeSubs} active subscriptions. Families
            sign up and subscribe per child.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScope("individual")}
              className="inline-flex min-h-11 items-center rounded-full bg-coral px-5 text-sm font-bold text-white"
            >
              View individual data
            </button>
            <Link
              to="/admin/children"
              onClick={() => setScope("individual")}
              className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
            >
              Manage subscribers
            </Link>
          </div>
        </section>
      </section>
    </>
  );
}
