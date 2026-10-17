import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listGoals, listPlans } from "@/api/plans";
import { LEVEL_GUIDANCE } from "@/api/domain";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { PlayPlanCard } from "@/components/PlayPlanCard";
import { ListSkeleton } from "@/components/Skeletons";
import { TOKEN_BG } from "@/components/brand";
import { cn } from "@/lib/utils";
import { Gift, Lock, UserRound } from "lucide-react";
import { ChooseFreePlanDialog, FreePlanBanner } from "@/features/plans/freePlan";
import { useFreePlan } from "@/features/plans/useFreePlan";
import type { Goal } from "@/lib/types";

export const Route = createFileRoute("/plans/")({
  head: () => ({
    meta: [
      { title: "Play Plans — Play Hub" },
      {
        name: "description",
        content:
          "Choose a Play Plan and its Rookie, Starter or Pro dose. Each dose is a week-long programme for the Fine Motor Play Kit.",
      },
      { property: "og:title", content: "Play Plans — Play Hub" },
      {
        property: "og:description",
        content:
          "Choose a Play Plan and its Rookie, Starter or Pro dose — a week-long programme for every skill.",
      },
    ],
  }),
  component: () => (
    <Protected permission="plans">
      <PlansPage />
    </Protected>
  ),
});

function PlansPage() {
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoals });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });
  const free = useFreePlan();
  const { session } = useSession();
  const [choosing, setChoosing] = useState<Goal | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Play plans"
        title="Choose a Play Plan and its dose."
        description={`Each Play Plan has three Play Doses: Rookie, Starter and Pro, each with its own activities. Begin with Starter. If your child finds it difficult, try Rookie. If they complete it successfully, move to Pro. You’ll use the Fine Motor Play Kit for every plan.`}
      />

      <FreePlanBanner goals={goals.data ?? []} plans={plans.data ?? []} />

      {plans.isLoading || goals.isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        (goals.data ?? []).map((goal) => {
          const goalPlans = (plans.data ?? []).filter((p) => p.goalId === goal.id);
          return (
            <section key={goal.id} className="mt-8 first:mt-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn("h-2.5 w-2.5 rounded-[3px]", TOKEN_BG[goal.color])}
                    aria-hidden
                  />
                  <h2 className="text-lg font-bold">{goalPlans[0]?.title ?? goal.name}</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white/70 px-3 py-1.5 text-xs text-navy/60">
                  <UserRound className="h-3.5 w-3.5 text-blue" aria-hidden />
                  <span>Created by</span>
                  <span className="font-semibold text-navy">{goal.createdBy ?? "Super Admin"}</span>
                </span>
                {free.active && goal.id === free.chosenGoalId && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/35 px-3 py-1 text-xs font-bold text-navy">
                    <Gift className="h-3.5 w-3.5" aria-hidden /> Your free plan
                  </span>
                )}
                {goal.publicationStatus === "locked" && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/35 px-3 py-1 text-xs font-bold text-navy">
                    <Lock className="h-3.5 w-3.5" aria-hidden /> Upcoming
                  </span>
                )}
              </div>

              <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {goalPlans.map((plan) => (
                  <li key={plan.id}>
                    <PlayPlanCard
                      plan={plan}
                      goal={goal}
                      access={free.accessFor(goal, plan)}
                      onChoose={() => setChoosing(goal)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {choosing && free.child && (
        <ChooseFreePlanDialog
          goal={choosing}
          planTitle={
            plans.data?.find((plan) => plan.goalId === choosing.id)?.title ?? choosing.name
          }
          childId={free.child.id}
          childName={free.child.name}
          onClose={() => setChoosing(null)}
        />
      )}
    </>
  );
}
