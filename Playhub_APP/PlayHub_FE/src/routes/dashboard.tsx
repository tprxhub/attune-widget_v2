import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CalendarCheck,
  MessagesSquare,
  PlayCircle,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { listAttempts } from "@/api/attempts";
import { goalById, planById } from "@/api/domain";
import { entryStates, nextEntry } from "@/api/plans";
import { getProgress } from "@/api/progress";
import { useCapabilities, useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { SchoolDashboard } from "@/components/dashboard/SchoolDashboard";
import { ComingSoonTiles, ConsultationCard } from "@/components/dashboard/DashboardExtras";
import { LockedOverlay } from "@/components/LockedOverlay";
import { StatusBadge, StatusIcon } from "@/components/StatusBadge";
import { CardSkeleton, ListSkeleton } from "@/components/Skeletons";
import { LevelDots } from "@/components/brand";
import { useActiveChild } from "@/lib/active-child";
import { fmtDate } from "@/lib/format";
import { AttemptScore } from "@/components/AttemptScore";

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
            Add a child to start a Play Plan and log Attempts.
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
  const lastAttempt = [...(attempts.data ?? [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )[0];
  const lastPlan = lastAttempt ? planById(lastAttempt.planId) : plan;
  const lastGoal = lastPlan ? goalById(lastPlan.goalId) : undefined;

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

      {/* Play Hub Summary */}
      <section className="ph-card mt-5 p-5">
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
              {report?.totalSessions ?? 0} sessions · {report?.activitiesCompleted ?? 0} Activities
              completed
            </p>
          </div>
        </div>
      </section>

      {/* Today's Play Dose */}
      <section className="ph-card mt-4 p-5">
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
                {report?.narrative ?? "Run today's Play Dose and log the Attempt while it's fresh."}
              </p>
            </div>
          </LockedOverlay>
        ) : (
          <div className="py-6 text-center text-sm text-navy/65">
            Nothing scheduled today — the week is complete.
          </div>
        )}
      </section>

      {/* Most recent Play Plan */}
      <section className="ph-card mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow text-blue">Most recent Play Plan</p>
          {lastAttempt && (
            <span className="text-xs font-semibold text-navy/55">
              Last check-in {fmtDate(lastAttempt.date)}
            </span>
          )}
        </div>
        {attempts.isLoading ? (
          <div className="mt-4">
            <CardSkeleton lines={3} />
          </div>
        ) : lastPlan ? (
          <div className="mt-4 grid gap-4 rounded-2xl bg-navy/[0.035] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold">{lastPlan.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <LevelDots level={lastPlan.level} />
                <span className="text-sm text-navy/65">{lastGoal?.name}</span>
              </div>
              {lastAttempt ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-navy/70">
                  <span>
                    Latest activity: <strong className="text-navy">{lastAttempt.activity}</strong>
                  </span>
                  <AttemptScore completion={lastAttempt.completion} mood={lastAttempt.mood} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-navy/65">
                  This is the current Play Plan. No check-ins have been logged yet.
                </p>
              )}
            </div>
            <Link
              to="/plans/$planId"
              params={{ planId: lastPlan.id }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white transition hover:bg-navy/90"
            >
              View Play Plan <PlayCircle className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-navy/65">
            No Play Plan has been started yet. Choose one from Play Plans to begin.
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
              You have the Introduction and the Day 0 Play Dose. Subscribe per child to unlock all
              five Play Doses, both Redo Days and Attempt logging.
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
