import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  MessagesSquare,
  PlayCircle,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { listAttempts } from "@/api/attempts";
import { goalById, planById } from "@/api/domain";
import { entryStates, listPlans, nextEntry } from "@/api/plans";
import { getProgress } from "@/api/progress";
import { useCapabilities, useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { SchoolDashboard } from "@/components/dashboard/SchoolDashboard";
import { ComingSoonTiles, ConsultationCard } from "@/components/dashboard/DashboardExtras";
import { LockedOverlay } from "@/components/LockedOverlay";
import { PlayPlanCard } from "@/components/PlayPlanCard";
import { StatusBadge, StatusIcon } from "@/components/StatusBadge";
import { CardSkeleton, ListSkeleton } from "@/components/Skeletons";
import { LevelDots } from "@/components/brand";
import { useActiveChild } from "@/lib/active-child";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Play Hub" },
      {
        name: "description",
        content: "Your Play Hub Summary and Today's Play Dose for each child.",
      },
      { property: "og:title", content: "Dashboard — Play Hub" },
      {
        property: "og:description",
        content: "Your Play Hub Summary and Today's Play Dose for each child.",
      },
    ],
  }),
  component: () => (
    <Protected>
      <Dashboard />
    </Protected>
  ),
});

function Dashboard() {
  const { session } = useSession();
  // The Principal (school Admin) oversees every child; Moderators and families keep the
  // single-child view below.
  return session.role === "educator" ? <SchoolDashboard /> : <ChildDashboard />;
}

function ChildDashboard() {
  const { session } = useSession();
  const { isFreeGated, canManageSubscription, isReadOnlyParent, canLogAttempts } =
    useCapabilities();
  const { activeChild, isLoading } = useActiveChild();

  const childId = activeChild?.id;
  const progress = useQuery({
    queryKey: ["progress", childId],
    queryFn: () => getProgress(childId!),
    enabled: !!childId,
  });
  const attempts = useQuery({
    queryKey: ["attempts", childId],
    queryFn: () => listAttempts(childId!),
    enabled: !!childId,
  });
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => listPlans(),
    enabled: !!activeChild,
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <CardSkeleton />
        <ListSkeleton />
      </div>
    );
  }

  if (!activeChild) {
    return (
      <>
        <PageHeader eyebrow="Play Hub" title={`Hello, ${session.name.split(" ")[0]}`} />
        <div className="ph-card p-8 text-center">
          <p className="text-lg font-bold">No child on your account yet</p>
          <p className="mt-2 text-sm text-navy/70">
            Add a child to start a Play Plan and log Sessions.
          </p>
          <Link
            to="/plans"
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-coral px-6 text-sm font-bold text-white"
          >
            Browse Play Plans
          </Link>
        </div>
      </>
    );
  }

  const plan = planById(activeChild.currentPlanId);
  const goal = plan ? goalById(plan.goalId) : undefined;
  const states = plan ? entryStates(plan, session, activeChild.planStartedAt) : [];
  const logged = (attempts.data ?? []).map((a) => a.entryId);
  const today = plan ? nextEntry(states, logged) : undefined;
  const report = progress.data;
  const catalogPlans = plans.data ?? [];
  const currentFocusPlans = plan
    ? catalogPlans.filter((candidate) => candidate.goalId === plan.goalId)
    : [];
  const featuredPlans = (currentFocusPlans.length ? currentFocusPlans : catalogPlans).slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Welcome back"
        title="Here's your Play Hub"
        description={
          isReadOnlyParent
            ? "A read-only view of your child's Play Plan, shared by their setting."
            : "A little play each day — that's the whole ask."
        }
        actions={
          canLogAttempts ? (
            <Link
              to="/check-in"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-bold hover:border-navy/40"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden /> Daily Check-In
            </Link>
          ) : null
        }
      />

      <div className="isolate mt-5 grid items-stretch gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {/* Play Hub Summary */}
        <section className="ph-card relative z-0 h-full p-5 hover:z-20 focus-within:z-20">
          <p className="eyebrow text-blue">Play Hub Summary</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <StatusIcon status={report?.status ?? "no_data"} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold">{activeChild.name}</p>
                <StatusBadge status={report?.status ?? "no_data"} size="sm" />
              </div>
              <p className="mt-2 text-sm text-navy/60">
                {report?.lastCheckIn
                  ? `Last check-in ${fmtDate(report.lastCheckIn)}`
                  : "No check-ins yet"}
              </p>
              <p className="text-sm text-navy/60">
                {report?.totalSessions ?? 0} sessions · {report?.activitiesCompleted ?? 0}{" "}
                Activities completed
              </p>
            </div>
          </div>
        </section>

        {/* Today's Play Dose */}
        <section className="ph-card relative z-0 h-full p-5">
          {today && plan ? (
            <LockedOverlay locked={!today.entitled}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow text-blue">Today's Play Dose</p>
                  <h2 className="mt-2.5 text-lg leading-snug font-bold">{today.entry.title}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <LevelDots level={plan.level} />
                    <span className="text-sm text-navy/60">{goal?.name}</span>
                  </div>
                </div>
                <Link
                  to="/plans/$planId/$entryId"
                  params={{ planId: plan.id, entryId: today.entry.id }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
                >
                  <PlayCircle className="h-5 w-5" aria-hidden /> Start Now
                </Link>
              </div>
              <div className="mt-4 rounded-2xl border-l-4 border-coral bg-cream p-4">
                <p className="text-[10.5px] font-bold tracking-[0.05em] text-coral uppercase">
                  Next step
                </p>
                <p className="mt-1 text-sm leading-relaxed text-navy/85">
                  {report?.narrative ??
                    "Run today's Play Dose and log the Session while it's fresh."}
                </p>
              </div>
            </LockedOverlay>
          ) : (
            <div className="py-6 text-center text-sm text-navy/65">
              Nothing scheduled today — the week is complete.
            </div>
          )}
        </section>
      </div>

      {/* Featured Play Plans */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-blue">Play Plans</p>
            <h2 className="mt-2 text-2xl font-extrabold text-navy">Choose the next Play Dose</h2>
            <p className="mt-1 text-sm text-navy/60">
              {goal
                ? `${goal.name} · Pick the level that feels right today.`
                : "Pick a plan and press play."}
            </p>
          </div>
          <Link
            to="/plans"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/15 px-5 text-sm font-bold text-navy transition hover:border-navy/40 hover:bg-white"
          >
            View all Play Plans <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {plans.isLoading ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        ) : featuredPlans.length > 0 ? (
          <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredPlans.map((featuredPlan) => {
              const featuredGoal = goalById(featuredPlan.goalId);
              return featuredGoal ? (
                <li key={featuredPlan.id}>
                  <PlayPlanCard plan={featuredPlan} goal={featuredGoal} />
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="mt-5 rounded-2xl bg-white p-5 text-sm text-navy/65">
            No Play Plans are available yet.
          </p>
        )}
      </section>

      <ComingSoonTiles />

      {/* Free upsell */}
      {isFreeGated && canManageSubscription && (
        <section className="ph-card mt-5 grid gap-4 border-2 border-coral/25 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="eyebrow text-coral">Free plan</p>
            <h2 className="mt-1 text-lg font-bold">Unlock the whole week for {activeChild.name}</h2>
            <p className="mt-1 text-sm text-navy/70">
              You have the Introduction and first Activity. Subscribe per child to unlock all five
              Activities, the Real Life Try, Level-Up Prompt and Session logging.
            </p>
          </div>
          <Link
            to="/subscription"
            search={{ checkout: undefined }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> See plans
          </Link>
        </section>
      )}

      <ConsultationCard />
    </>
  );
}
