import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Gem,
  Lock,
  Repeat,
  Rocket,
} from "lucide-react";
import { listAttempts } from "@/api/attempts";
import { goalById, planByGoalAndLevel, planById } from "@/api/domain";
import { entryStates, getPlan } from "@/api/plans";
import { useSession } from "@/auth/session";
import { Protected } from "@/auth/guards";
import { ListSkeleton } from "@/components/Skeletons";
import { LevelDots, TOKEN_SOFT } from "@/components/brand";
import { GoalIcon } from "@/components/icons";
import { AttemptScore } from "@/components/AttemptScore";
import { useActiveChild } from "@/lib/active-child";
import { LEVELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FreePlanGate } from "@/features/plans/freePlan";
import { useFreePlan } from "@/features/plans/useFreePlan";

export const Route = createFileRoute("/plans/$planId/")({
  head: ({ params }) => {
    const plan = planById(params.planId);
    const title = plan ? `${plan.title} — ${plan.level} — Play Hub` : "Play Plan — Play Hub";
    const description = plan?.summary ?? "A guided one-week Play Plan with a clear next step.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: () => (
    <Protected permission="plans">
      <PlanWeek />
    </Protected>
  ),
});

const GRADIENT: Record<string, string> = {
  coral: "from-coral to-navy",
  blue: "from-blue to-navy",
  amber: "from-amber to-navy",
  navy: "from-navy to-navy",
};

function PlanWeek() {
  const { planId } = Route.useParams();
  const { session } = useSession();
  const { activeChild } = useActiveChild();
  const free = useFreePlan();
  const plan = useQuery({ queryKey: ["plan", planId], queryFn: () => getPlan(planId) });
  const attempts = useQuery({
    queryKey: ["attempts", activeChild?.id],
    queryFn: () => listAttempts(activeChild!.id),
    enabled: !!activeChild,
  });

  if (plan.isLoading) return <ListSkeleton rows={6} />;
  if (!plan.data) return <p className="ph-card p-8 text-center">That Play Plan doesn't exist.</p>;

  const data = plan.data;
  const goal = goalById(data.goalId);
  if (goal && free.accessFor(goal, data) !== "open") {
    return (
      <>
        <Link
          to="/plans"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-bold hover:border-navy/40"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Play Plans
        </Link>
        <FreePlanGate goal={goal} dose={data} />
      </>
    );
  }
  const token = goal?.color ?? "navy";
  const startedAt =
    activeChild && activeChild.currentPlanId === data.id
      ? activeChild.planStartedAt
      : new Date().toISOString().slice(0, 10);
  const states = entryStates(data, session, startedAt);

  const byEntry = new Map<string, { count: number; completion: number; mood: number }>();
  for (const a of attempts.data ?? []) {
    byEntry.set(a.entryId, {
      count: (byEntry.get(a.entryId)?.count ?? 0) + 1,
      completion: a.completion,
      mood: a.mood,
    });
  }

  const nextUp = states.find((s) => s.entry.loggable && s.entitled && !byEntry.has(s.entry.id));

  return (
    <>
      <Link
        to="/plans"
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-bold hover:border-navy/40"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Play Plans
      </Link>

      {/* Hero */}
      <section className="ph-card mt-4 overflow-hidden p-0">
        <div
          className={cn(
            "relative flex h-[150px] items-end overflow-hidden bg-gradient-to-br p-6",
            GRADIENT[token],
          )}
        >
          <span
            className="pointer-events-none absolute block -top-16 -right-8 h-40 w-40 rounded-full bg-white/20"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute block -bottom-8 left-8 h-24 w-24 rounded-full bg-white/15"
            aria-hidden
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-navy">
              <GoalIcon goalId={data.goalId} className="h-3.5 w-3.5" /> {goal?.name}
            </span>
            <h1 className="mt-2.5 text-2xl font-bold text-white sm:text-3xl">
              {data.title} <span className="text-lg font-medium opacity-80">— {data.level}</span>
            </h1>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <LevelDots level={data.level} />
            <span className="text-sm text-navy/65">Ages {data.age ?? "3+"}</span>
            <span className={cn("rounded-full px-3 py-1 text-xs font-bold", TOKEN_SOFT[token])}>
              {data.kit}
            </span>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-navy/85">{data.summary}</p>
          <p className="mt-2 text-sm text-navy/60">
            Not sure this is the right level? Start at Starter — move down to Rookie if it's
            difficult, or up to Pro if it feels easy.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {nextUp ? (
              <Link
                to="/plans/$planId/$entryId"
                params={{ planId: data.id, entryId: nextUp.entry.id }}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white"
              >
                Continue: {nextUp.entry.label} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-blue px-6 text-sm font-bold text-white">
                <Check className="h-4 w-4" aria-hidden /> All checkpoints attempted
              </span>
            )}
            {LEVELS.filter((level) => level !== data.level).map((level) => {
              const sibling = planByGoalAndLevel(data.goalId, level);
              return sibling ? (
                <Link
                  key={level}
                  to="/plans/$planId"
                  params={{ planId: sibling.id }}
                  className="inline-flex min-h-12 items-center rounded-full border border-navy/15 px-5 text-sm font-bold hover:border-navy/40"
                >
                  Switch to {level}
                </Link>
              ) : null;
            })}
          </div>
        </div>
      </section>

      {/* Play Doses timeline */}
      <section className="ph-card mt-5 p-6">
        <h2 className="text-[17px] font-bold">Play Doses</h2>
        <ol className="relative mt-3">
          <span
            className="absolute top-0 bottom-0 left-[15px] w-0.5 rounded bg-navy/8"
            aria-hidden
          />
          {states.map((state, i) => {
            const { entry } = state;
            const locked = !state.entitled;
            const attempt = byEntry.get(entry.id);
            const isIntro = entry.kind === "intro";
            const isRedo = entry.kind === "redo";
            const isLevelUp = entry.kind === "levelup";
            const last = i === states.length - 1;

            const Icon = isIntro
              ? ClipboardList
              : isRedo
                ? Repeat
                : isLevelUp
                  ? data.level === "Pro"
                    ? Gem
                    : Rocket
                  : locked
                    ? Lock
                    : attempt
                      ? Check
                      : null;

            const row = (
              <div
                className={cn(
                  "relative flex items-center gap-3.5 py-3.5",
                  !last && "border-b border-navy/6",
                )}
              >
                <span
                  className={cn(
                    "relative z-[1] grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full",
                    isRedo
                      ? "bg-coral/12 text-coral"
                      : isLevelUp
                        ? "bg-amber/25 text-navy"
                        : locked
                          ? "bg-navy/8 text-navy/45"
                          : attempt
                            ? "bg-blue/12 text-blue"
                            : "bg-navy/6 text-navy/60",
                  )}
                >
                  {Icon ? (
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <GoalIcon goalId={data.goalId} className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-semibold",
                      isRedo && "text-coral",
                      isLevelUp && "text-amber-foreground text-navy",
                    )}
                  >
                    {entry.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-navy/55">
                    {attempt ? (
                      <>
                        {attempt.count} session{attempt.count > 1 ? "s" : ""} · last
                        <AttemptScore
                          completion={attempt.completion}
                          mood={attempt.mood}
                          className="px-2 py-0.5 text-[10px]"
                        />
                      </>
                    ) : (
                      "Ready to play"
                    )}
                  </span>
                </span>
                {!state.entitled ? (
                  <span className="shrink-0 text-xs font-bold text-navy/45">Locked</span>
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0 text-navy/30" aria-hidden />
                )}
              </div>
            );

            return (
              <li key={entry.id}>
                {state.entitled ? (
                  <Link
                    to="/plans/$planId/$entryId"
                    params={{ planId: data.id, entryId: entry.id }}
                    className="block"
                  >
                    {row}
                  </Link>
                ) : (
                  <Link to="/subscription" search={{ checkout: undefined }} className="block">
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Play Consultation upsell */}
      <section className="ph-card mt-4 flex flex-wrap items-center gap-4 border-l-4 border-amber p-5">
        <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-amber/25 text-navy">
          <Gem className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-[180px] flex-1">
          <p className="text-sm font-bold">Want a professional eye on this week?</p>
          <p className="mt-0.5 text-sm text-navy/60">
            A 1:1 Play Consultation tailors the plan to your child.
          </p>
        </div>
        <a
          href="https://thetoypharmacy.com/products/play-consult-call"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-full bg-amber px-5 text-sm font-bold text-navy"
        >
          Book
        </a>
      </section>
    </>
  );
}
