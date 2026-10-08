import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  HeartHandshake,
  LayoutPanelTop,
  Lock,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getAdminOverview, type AdminOverview, type OverviewArea } from "@/api/admin";
import { STATUS_META } from "@/api/progress";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { actionTitle } from "@/lib/audit-labels";
import { fmtDate, fmtDateTime, fmtShortDate } from "@/lib/format";
import { fmtMoney } from "@/lib/money";
import { useOrgScope } from "@/lib/org-scope";
import type { StatusKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Platform overview — Play Hub admin" },
      {
        name: "description",
        content: "Children, progress, organisations, subscriptions and content across Play Hub.",
      },
    ],
  }),
  component: () => (
    <Protected roles={["super_admin", "ttp_employee"]}>
      <AdminOverviewPage />
    </Protected>
  ),
});

/** Every area a TTP employee can be given, with where it lives and what it covers. */
const AREAS: { key: OverviewArea; label: string; to: string; icon: LucideIcon; hint: string }[] = [
  {
    key: "children",
    label: "Children",
    to: "/admin/children",
    icon: Users,
    hint: "Profiles, plans and Moderators",
  },
  {
    key: "progress",
    label: "Progress",
    to: "/admin/progress",
    icon: Activity,
    hint: "Sessions and Play Dose results",
  },
  {
    key: "billing",
    label: "Subscriptions",
    to: "/admin/children",
    icon: CreditCard,
    hint: "Family plans and revenue",
  },
  {
    key: "organisations",
    label: "Organisations",
    to: "/admin/orgs",
    icon: Building2,
    hint: "Schools, clinics and licences",
  },
  {
    key: "team",
    label: "Admins & Moderators",
    to: "/admin/educators",
    icon: HeartHandshake,
    hint: "Organisation staff and invites",
  },
  {
    key: "plans",
    label: "Plans library",
    to: "/admin/plans",
    icon: ClipboardList,
    hint: "Play Plans, Doses and Activities",
  },
  {
    key: "audit",
    label: "Audit log",
    to: "/admin/audit",
    icon: ShieldCheck,
    hint: "Who changed what, and when",
  },
  {
    key: "homepage",
    label: "Home page",
    to: "/admin/homepage",
    icon: LayoutPanelTop,
    hint: "Public home page wording",
  },
];

const PLAN_NAMES: Record<string, string> = {
  "3m": "3 months",
  "6m": "6 months",
  "12m": "12 months",
  manual: "Granted by hand",
};
const STATUS_ORDER: StatusKey[] = [
  "progressing",
  "first_dose",
  "settling_in",
  "holding_steady",
  "needs_check_in",
  "no_data",
];
const STATUS_BAR: Record<string, string> = {
  blue: "bg-blue",
  amber: "bg-amber",
  coral: "bg-coral",
  navy: "bg-navy",
};

function AdminOverviewPage() {
  const { session } = useSession();
  const isTtp = session.role === "ttp_employee";
  const { scopeId, label } = useOrgScope();
  const overview = useQuery({
    queryKey: ["admin-overview", scopeId],
    queryFn: () => getAdminOverview(scopeId),
    refetchOnWindowFocus: true,
  });

  const header = (
    <PageHeader
      eyebrow={isTtp ? "TTP Employee" : "Super Admin"}
      title="Platform overview"
      description={
        scopeId === "all" ? "Key numbers and follow-ups across Play Hub." : `Showing ${label}.`
      }
    />
  );

  if (overview.isLoading || !overview.data) {
    return (
      <>
        {header}
        {overview.isError ? (
          <p role="alert" className="ph-card p-6 text-sm text-coral">
            The overview could not load. Refresh the page to try again.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <CardSkeleton key={i} lines={2} />
            ))}
          </div>
        )}
      </>
    );
  }

  const data = overview.data;
  const granted = AREAS.filter((area) => data.access[area.key]);

  if (granted.length === 0) {
    return (
      <>
        {header}
        <NoAccessYet />
      </>
    );
  }

  return (
    <>
      {header}
      {isTtp && <YourAccess access={data.access} />}
      <KeyFigures data={data} compact={!isTtp} />
      <NeedsAttention data={data} />

      {isTtp ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:items-start">
          {data.progress && <ProgressCard progress={data.progress} />}
          {data.children && <ChildrenCard children={data.children} />}
          {data.billing && <BillingCard billing={data.billing} />}
          {data.organisations && <OrganisationsCard orgs={data.organisations} />}
          {data.team && <TeamCard team={data.team} />}
          {data.plans && <ContentCard plans={data.plans} homepage={data.homepage} />}
          {!data.plans && data.homepage && <HomepageCard homepage={data.homepage} />}
          {data.audit && <RecentActivity audit={data.audit} />}
        </div>
      ) : (
        <ExploreTabs data={data} />
      )}

      <p className="mt-6 text-center text-xs text-navy/45">
        Updated {fmtDateTime(data.generated_at)}.
      </p>
    </>
  );
}

function ExploreTabs({ data }: { data: AdminOverview }) {
  const [selected, setSelected] = useState("progress");
  const tabs: { id: string; title: string; icon: LucideIcon; content: ReactNode }[] = [];
  if (data.progress)
    tabs.push({
      id: "progress",
      title: "Progress",
      icon: Activity,
      content: <ProgressCard progress={data.progress} />,
    });
  if (data.children)
    tabs.push({
      id: "children",
      title: "Children",
      icon: Users,
      content: <ChildrenCard children={data.children} />,
    });
  if (data.billing)
    tabs.push({
      id: "billing",
      title: "Subscriptions",
      icon: CreditCard,
      content: <BillingCard billing={data.billing} />,
    });
  if (data.organisations)
    tabs.push({
      id: "organisations",
      title: "Organisations",
      icon: Building2,
      content: <OrganisationsCard orgs={data.organisations} />,
    });
  if (data.team)
    tabs.push({
      id: "team",
      title: "Team",
      icon: HeartHandshake,
      content: <TeamCard team={data.team} />,
    });
  if (data.plans || data.homepage)
    tabs.push({
      id: "content",
      title: "Content",
      icon: ClipboardList,
      content: data.plans ? (
        <ContentCard plans={data.plans} homepage={data.homepage} />
      ) : (
        data.homepage && <HomepageCard homepage={data.homepage} />
      ),
    });
  if (data.audit)
    tabs.push({
      id: "audit",
      title: "Recent activity",
      icon: ShieldCheck,
      content: <RecentActivity audit={data.audit} />,
    });
  const active = tabs.some((tab) => tab.id === selected) ? selected : tabs[0]?.id;
  return (
    <section className="mt-5" aria-labelledby="overview-details-heading">
      <h2 id="overview-details-heading" className="mb-3 text-lg font-bold">
        Explore details
      </h2>
      <div
        role="tablist"
        aria-label="Explore details"
        className="flex gap-2 overflow-x-auto rounded-2xl bg-navy/5 p-2"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`overview-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`overview-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setSelected(tab.id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault();
              const target = tabs[next]!;
              setSelected(target.id);
              document.getElementById(`overview-tab-${target.id}`)?.focus();
            }}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue",
              active === tab.id
                ? "bg-navy text-white shadow-sm"
                : "text-navy/65 hover:bg-white hover:text-navy",
            )}
          >
            <tab.icon className="h-4 w-4" aria-hidden />
            {tab.title}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`overview-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`overview-tab-${tab.id}`}
          hidden={active !== tab.id}
          tabIndex={0}
          className="mt-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-blue"
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────────────────────

function Card({
  eyebrow,
  title,
  to,
  linkLabel,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  to?: string;
  linkLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("ph-card ph-rise flex flex-col p-5", className)} aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-blue">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-bold">{title}</h2>
        </div>
        {to && (
          <Link
            to={to}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-blue hover:bg-blue/8"
          >
            {linkLabel ?? "Open"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

function Figure({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-navy/[0.035] p-3">
      <p className="text-[11px] font-bold tracking-wide text-navy/50 uppercase">{label}</p>
      <p className="mt-1 text-2xl leading-none font-bold">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-navy/55">{hint}</p>}
    </div>
  );
}

function Meter({ value, max, tone = "bg-blue" }: { value: number; max: number; tone?: string }) {
  const percent = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-navy/8" aria-hidden>
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${percent}%` }} />
    </div>
  );
}

function Trend({ now, before }: { now: number; before: number }) {
  if (!before)
    return now ? (
      <span className="text-blue">New activity this month</span>
    ) : (
      <span>No sessions yet</span>
    );
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 font-bold", up ? "text-blue" : "text-coral")}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {up ? "+" : ""}
      {change}% vs previous 30 days
    </span>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────────────────────────

function YourAccess({ access }: { access: AdminOverview["access"] }) {
  return (
    <section className="ph-card mb-5 p-4" aria-label="Your access">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-bold text-navy/60">
          <BadgeCheck className="h-4 w-4 text-blue" aria-hidden /> Your access
        </span>
        {AREAS.map((area) =>
          access[area.key] ? (
            <Link
              key={area.key}
              to={area.to}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue/10 px-3 py-1 text-xs font-bold text-blue hover:bg-blue/15"
            >
              <area.icon className="h-3.5 w-3.5" aria-hidden /> {area.label}
            </Link>
          ) : (
            <span
              key={area.key}
              title="Ask a Super Admin if you need this"
              className="inline-flex items-center gap-1.5 rounded-full bg-navy/5 px-3 py-1 text-xs font-semibold text-navy/40"
            >
              <Lock className="h-3 w-3" aria-hidden /> {area.label}
            </span>
          ),
        )}
      </div>
    </section>
  );
}

function NoAccessYet() {
  return (
    <section className="ph-card p-6 sm:p-8">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy/8 text-navy">
        <ShieldCheck className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-bold">
        Your account is ready. No areas are switched on yet.
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-navy/65">
        A Super Admin chooses which parts of Play Hub each TTP employee can use. Tell them which of
        these you need, and they will appear here and in the menu straight away.
      </p>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {AREAS.map((area) => (
          <li key={area.key} className="flex items-start gap-3 rounded-2xl bg-navy/[0.035] p-3">
            <area.icon className="mt-0.5 h-4 w-4 shrink-0 text-navy/50" aria-hidden />
            <span>
              <span className="block text-sm font-bold">{area.label}</span>
              <span className="block text-xs text-navy/55">{area.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function KeyFigures({ data, compact = false }: { data: AdminOverview; compact?: boolean }) {
  const tiles: {
    label: string;
    value: ReactNode;
    hint: ReactNode;
    icon: LucideIcon;
    tone: string;
  }[] = [];
  if (data.children)
    tiles.push({
      label: "Children",
      value: data.children.total,
      hint: `${data.children.new_30d} new in the last 30 days`,
      icon: Users,
      tone: "bg-blue/12 text-blue",
    });
  if (data.children)
    tiles.push({
      label: "Active this fortnight",
      value: data.children.active_14d,
      hint: data.children.total
        ? `${Math.round((data.children.active_14d / data.children.total) * 100)}% logged a session in 14 days`
        : "No children yet",
      icon: CheckCircle2,
      tone: "bg-blue/12 text-blue",
    });
  if (data.progress)
    tiles.push({
      label: "Sessions (30 days)",
      value: data.progress.sessions_30d,
      hint: <Trend now={data.progress.sessions_30d} before={data.progress.sessions_prev_30d} />,
      icon: Activity,
      tone: "bg-coral/12 text-coral",
    });
  if (data.billing)
    tiles.push({
      label: "Active subscriptions",
      value: data.billing.active,
      hint: `${fmtMoney(data.billing.paid_30d)} paid in 30 days`,
      icon: CreditCard,
      tone: "bg-amber/25 text-navy",
    });
  if (data.organisations)
    tiles.push({
      label: "Organisations",
      value: compact
        ? data.organisations.active
        : `${data.organisations.active} / ${data.organisations.total}`,
      hint: compact
        ? "Active schools and clinics"
        : data.organisations.seats_total
          ? `${data.organisations.seats_used} of ${data.organisations.seats_total} licences in use`
          : "active / total",
      icon: Building2,
      tone: "bg-navy/8 text-navy",
    });
  if (data.team)
    tiles.push({
      label: "Organisation staff",
      value: data.team.admins + data.team.moderators,
      hint: `${data.team.admins} Admins · ${data.team.moderators} Moderators`,
      icon: HeartHandshake,
      tone: "bg-navy/8 text-navy",
    });
  if (data.plans)
    tiles.push({
      label: "Published plans",
      value: `${data.plans.published} / ${data.plans.plans}`,
      hint: `${data.plans.doses} Play Doses · ${data.plans.activities} activities`,
      icon: ClipboardList,
      tone: "bg-navy/8 text-navy",
    });
  const visibleTiles = compact
    ? tiles.filter((tile) =>
        ["Children", "Sessions (30 days)", "Active subscriptions", "Organisations"].includes(
          tile.label,
        ),
      )
    : tiles;
  if (!visibleTiles.length) return null;
  return (
    <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {visibleTiles.slice(0, 8).map((tile) => (
        <div key={tile.label} className="ph-card ph-rise p-5">
          <span className={cn("inline-grid h-10 w-10 place-items-center rounded-2xl", tile.tone)}>
            <tile.icon className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-[11px] font-bold tracking-wide text-navy/55 uppercase">
            {tile.label}
          </p>
          <p className="mt-1 text-3xl font-bold">{tile.value}</p>
          <p className="mt-1 text-xs text-navy/55">{tile.hint}</p>
        </div>
      ))}
    </section>
  );
}

function NeedsAttention({ data }: { data: AdminOverview }) {
  const items: { label: string; detail: string; to: string; tone: "coral" | "amber" }[] = [];
  const consult = data.progress?.statuses["needs_check_in"] ?? 0;
  if (consult)
    items.push({
      label: `${consult} ${consult === 1 ? "child needs" : "children need"} a Play Consult`,
      detail: "The Real-Life Try wasn’t passed for two doses in a row.",
      to: "/admin/progress",
      tone: "coral",
    });
  if (data.children?.inactive_14d)
    items.push({
      label: `${data.children.inactive_14d} ${data.children.inactive_14d === 1 ? "child has" : "children have"} gone quiet`,
      detail: "No session logged in the last 14 days.",
      to: "/admin/children",
      tone: "amber",
    });
  if (data.children?.without_moderator)
    items.push({
      label: `${data.children.without_moderator} without a Moderator`,
      detail: "Assign someone so sessions keep getting logged.",
      to: "/admin/children",
      tone: "amber",
    });
  if (data.billing?.ending_14d)
    items.push({
      label: `${data.billing.ending_14d} ${data.billing.ending_14d === 1 ? "subscription ends" : "subscriptions end"} within 14 days`,
      detail: "Families already see a gentle renewal reminder.",
      to: "/admin/children",
      tone: "amber",
    });
  for (const org of data.organisations?.near_capacity ?? [])
    items.push({
      label: `${org.name} is at ${org.used} of ${org.limit} licences`,
      detail: "Raise the licence count before they need to enrol more children.",
      to: "/admin/orgs",
      tone: org.used >= org.limit ? "coral" : "amber",
    });
  if (data.team?.expired_invitations)
    items.push({
      label: `${data.team.expired_invitations} staff ${data.team.expired_invitations === 1 ? "invite has" : "invites have"} expired`,
      detail: "Send a fresh activation link.",
      to: "/admin/educators",
      tone: "amber",
    });
  if (data.plans?.activities_without_video)
    items.push({
      label: `${data.plans.activities_without_video} activities have no video yet`,
      detail: "Families see “video coming soon” on these.",
      to: "/admin/plans",
      tone: "amber",
    });

  return (
    <section className="ph-card mt-5 p-5" aria-label="Needs attention">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <AlertTriangle className="h-5 w-5 text-coral" aria-hidden /> Needs attention
        </h2>
        {items.length > 0 && (
          <span className="rounded-full bg-coral/10 px-2.5 py-0.5 text-xs font-bold text-coral">
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-blue/8 px-4 py-3 text-sm font-semibold text-blue">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> All clear in the areas you can see.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.label}>
              <Link
                to={item.to}
                className="group flex items-start gap-3 rounded-2xl border border-navy/10 p-3 transition hover:border-navy/25 hover:bg-navy/[0.02]"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    item.tone === "coral" ? "bg-coral" : "bg-amber",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="block text-xs text-navy/55">{item.detail}</span>
                </span>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-navy/30 transition group-hover:translate-x-0.5 group-hover:text-navy/60"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProgressCard({ progress }: { progress: NonNullable<AdminOverview["progress"]> }) {
  const peak = Math.max(1, ...progress.weekly.map((week) => week.sessions));
  const total = Object.values(progress.statuses).reduce((a, b) => a + b, 0);
  const statuses = STATUS_ORDER.map((key) => ({
    key,
    count: progress.statuses[key === "no_data" ? "insufficient_data" : key] ?? 0,
    meta: STATUS_META[key],
  })).filter((row) => row.count > 0);

  return (
    <Card
      eyebrow="Progress"
      title="Sessions and outcomes"
      to="/admin/progress"
      linkLabel="Progress"
    >
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Last 7 days" value={progress.sessions_7d} />
        <Figure label="Last 30 days" value={progress.sessions_30d} />
        <Figure
          label="Finished in 15 min"
          value={progress.finished_rate_30d === null ? "—" : `${progress.finished_rate_30d}%`}
        />
      </div>

      <p className="mt-5 flex items-center justify-between text-xs font-bold text-navy/55">
        Sessions per week
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 rounded-sm bg-coral" aria-hidden /> This week so far
        </span>
      </p>
      <div
        className="mt-2 flex h-28 items-end gap-2"
        role="img"
        aria-label={`Sessions per week for the last ${progress.weekly.length} weeks: ${progress.weekly.map((w) => w.sessions).join(", ")}`}
      >
        {progress.weekly.map((week, index) => (
          <div
            key={week.week_start}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-[10px] font-bold text-navy/60">{week.sessions || ""}</span>
            <div
              className={cn(
                "w-full rounded-t-md",
                index === progress.weekly.length - 1 ? "bg-coral" : "bg-blue/70",
              )}
              style={{ height: `${Math.max(4, (week.sessions / peak) * 100)}%` }}
              title={`Week of ${fmtDate(week.week_start)}: ${week.sessions} sessions`}
            />
            <span className="text-[10px] text-navy/45">{fmtShortDate(week.week_start)}</span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <>
          <p className="mt-5 text-xs font-bold text-navy/55">Where children are now</p>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-navy/8">
            {statuses.map((row) => (
              <div
                key={row.key}
                className={STATUS_BAR[row.meta.token]}
                style={{
                  width: `${(row.count / total) * 100}%`,
                  opacity: row.key === "no_data" ? 0.35 : 1,
                }}
                title={`${row.meta.label}: ${row.count}`}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {statuses.map((row) => (
              <li key={row.key} className="flex items-center gap-1.5 text-xs text-navy/65">
                <span
                  className={cn("h-2 w-2 rounded-full", STATUS_BAR[row.meta.token])}
                  style={{ opacity: row.key === "no_data" ? 0.35 : 1 }}
                  aria-hidden
                />
                {row.meta.label} <span className="font-bold text-navy">{row.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {progress.needs_consult.length > 0 && (
        <>
          <p className="mt-5 text-xs font-bold text-navy/55">Book a Play Consult</p>
          <ul className="mt-2 divide-y divide-navy/8 rounded-2xl border border-navy/10">
            {progress.needs_consult.map((child) => (
              <li
                key={child.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-bold">
                  {child.name}
                  <span className="font-normal text-navy/55">
                    {" "}
                    · {child.organisation ?? "Family account"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-navy/55">
                  {child.last_check_in
                    ? `Last ${fmtShortDate(child.last_check_in)}`
                    : "No sessions"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function ChildrenCard({ children }: { children: NonNullable<AdminOverview["children"]> }) {
  return (
    <Card eyebrow="Children" title="Engagement" to="/admin/children" linkLabel="Children">
      <div className="grid grid-cols-2 gap-2">
        <Figure label="Family accounts" value={children.individual} />
        <Figure label="Organisations" value={children.organisation} />
      </div>
      <div className="mt-4 space-y-3">
        {[
          { label: "Logged in the last 14 days", value: children.active_14d, tone: "bg-blue" },
          { label: "Quiet for 14 days or more", value: children.inactive_14d, tone: "bg-amber" },
          { label: "Never logged a session", value: children.never_logged, tone: "bg-navy/40" },
        ].map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-xs">
              <span className="text-navy/65">{row.label}</span>
              <span className="font-bold">{row.value}</span>
            </div>
            <div className="mt-1">
              <Meter value={row.value} max={children.total} tone={row.tone} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-navy/55">
        {children.new_30d} joined in the last 30 days ·{" "}
        {children.without_moderator
          ? `${children.without_moderator} without a Moderator`
          : "everyone has a Moderator"}
      </p>
    </Card>
  );
}

function BillingCard({ billing }: { billing: NonNullable<AdminOverview["billing"]> }) {
  const plans = Object.entries(billing.by_plan).sort(([, a], [, b]) => b - a);
  const families = billing.active + billing.free_families;
  return (
    <Card
      eyebrow="Subscriptions"
      title="Families and revenue"
      to="/admin/children"
      linkLabel="Subscribers"
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure
          label="Paid in 30 days"
          value={fmtMoney(billing.paid_30d)}
          hint="Card payments, refunds excluded"
        />
        <Figure
          label="Subscribed"
          value={`${billing.active} / ${families}`}
          hint={
            families
              ? `${Math.round((billing.active / families) * 100)}% of families`
              : "No families yet"
          }
        />
        <Figure label="Ending in 14 days" value={billing.ending_14d} />
        <Figure label="Ended in 30 days" value={billing.ended_30d} />
      </div>
      {plans.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold text-navy/55">Active plans</p>
          <ul className="mt-2 space-y-2">
            {plans.map(([plan, count]) => (
              <li key={plan}>
                <div className="flex justify-between text-xs">
                  <span className="text-navy/65">{PLAN_NAMES[plan] ?? plan}</span>
                  <span className="font-bold">{count}</span>
                </div>
                <div className="mt-1">
                  <Meter value={count} max={billing.active} tone="bg-amber" />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function OrganisationsCard({ orgs }: { orgs: NonNullable<AdminOverview["organisations"]> }) {
  const percent = orgs.seats_total ? Math.round((orgs.seats_used / orgs.seats_total) * 100) : 0;
  return (
    <Card
      eyebrow="Organisations"
      title="Schools and clinics"
      to="/admin/orgs"
      linkLabel="Organisations"
    >
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Active" value={orgs.active} />
        <Figure label="Suspended" value={orgs.suspended} />
        <Figure label="Licences used" value={orgs.seats_total ? `${percent}%` : "—"} />
      </div>
      {orgs.seats_total > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs">
            <span className="text-navy/65">Licences in use across active organisations</span>
            <span className="font-bold">
              {orgs.seats_used} / {orgs.seats_total}
            </span>
          </div>
          <div className="mt-1">
            <Meter
              value={orgs.seats_used}
              max={orgs.seats_total}
              tone={percent >= 90 ? "bg-coral" : "bg-blue"}
            />
          </div>
        </div>
      )}
      {orgs.newest.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold text-navy/55">Newest</p>
          <ul className="mt-2 divide-y divide-navy/8 rounded-2xl border border-navy/10">
            {orgs.newest.map((org) => (
              <li
                key={org.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-bold">
                  {org.name}
                  {!org.is_active && <span className="font-normal text-coral"> · suspended</span>}
                </span>
                <span className="shrink-0 text-xs text-navy/55">
                  {org.used}
                  {org.limit ? ` / ${org.limit}` : ""} children
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function TeamCard({ team }: { team: NonNullable<AdminOverview["team"]> }) {
  return (
    <Card eyebrow="Team" title="Organisation staff" to="/admin/educators" linkLabel="Team">
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Admins" value={team.admins} />
        <Figure label="Moderators" value={team.moderators} />
        <Figure
          label="Invites pending"
          value={team.pending_invitations}
          hint={team.expired_invitations ? `${team.expired_invitations} expired` : undefined}
        />
      </div>
      {team.moderator_load.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold text-navy/55">Busiest Moderators</p>
          <ul className="mt-2 space-y-2">
            {team.moderator_load.map((row) => (
              <li key={row.name}>
                <div className="flex justify-between text-xs">
                  <span className="text-navy/65">{row.name}</span>
                  <span className="font-bold">
                    {row.children} {row.children === 1 ? "child" : "children"}
                  </span>
                </div>
                <div className="mt-1">
                  <Meter value={row.children} max={team.moderator_load[0]!.children} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function ContentCard({
  plans,
  homepage,
}: {
  plans: NonNullable<AdminOverview["plans"]>;
  homepage: AdminOverview["homepage"];
}) {
  return (
    <Card eyebrow="Content" title="Plans library" to="/admin/plans" linkLabel="Library">
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Published" value={plans.published} />
        <Figure label="Hidden" value={plans.invisible} />
        <Figure label="Locked" value={plans.locked} />
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs">
          <span className="text-navy/65">Activities with a video</span>
          <span className="font-bold">
            {plans.activities - plans.activities_without_video} / {plans.activities}
          </span>
        </div>
        <div className="mt-1">
          <Meter value={plans.activities - plans.activities_without_video} max={plans.activities} />
        </div>
      </div>
      {plans.most_followed.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold text-navy/55">Most followed right now</p>
          <ol className="mt-2 space-y-1.5">
            {plans.most_followed.map((plan, index) => (
              <li key={plan.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="mr-2 font-bold text-navy/40">{index + 1}</span>
                  {plan.name}
                </span>
                <span className="shrink-0 text-xs font-bold">{plan.children}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {homepage && <HomepageLine homepage={homepage} />}
    </Card>
  );
}

function HomepageLine({ homepage }: { homepage: NonNullable<AdminOverview["homepage"]> }) {
  return (
    <p className="mt-4 rounded-2xl bg-navy/[0.035] px-3 py-2 text-xs text-navy/65">
      Home page{" "}
      {homepage.updated_at
        ? `last edited ${fmtDate(homepage.updated_at)}${homepage.updated_by ? ` by ${homepage.updated_by}` : ""}`
        : "still shows the built-in wording"}
      .{" "}
      <Link to="/admin/homepage" className="font-bold text-blue hover:underline">
        Edit
      </Link>
    </p>
  );
}

function HomepageCard({ homepage }: { homepage: NonNullable<AdminOverview["homepage"]> }) {
  return (
    <Card eyebrow="Content" title="Home page" to="/admin/homepage" linkLabel="Edit">
      <HomepageLine homepage={homepage} />
    </Card>
  );
}

function RecentActivity({ audit }: { audit: NonNullable<AdminOverview["audit"]> }) {
  return (
    <Card eyebrow="Audit log" title="Recent activity" to="/admin/audit" linkLabel="Audit log">
      {audit.recent.length === 0 ? (
        <p className="text-sm text-navy/55">Nothing recorded yet in the log types you can read.</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-navy/8 pl-4">
          {audit.recent.map((event, index) => (
            <li key={`${event.created_at}-${index}`} className="relative">
              <span
                className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-blue"
                aria-hidden
              />
              <p className="text-sm font-bold">{actionTitle(event.action)}</p>
              <p className="text-xs text-navy/55">
                {event.actor_name ?? "System"} · {fmtDateTime(event.created_at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
