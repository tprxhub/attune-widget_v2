import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listGoals, listPlans } from "@/api/plans";
import { LEVEL_GUIDANCE } from "@/api/domain";
import { Protected } from "@/auth/guards";
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
          "Pick a Plan, pick a level, press play. Every Play Plan is a week-long Play Dose for the Fine Motor Play Kit.",
      },
      { property: "og:title", content: "Play Plans — Play Hub" },
      {
        property: "og:description",
        content: "Pick a Plan, pick a level, press play — a week-long Play Dose for every skill.",
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
  const [choosing, setChoosing] = useState<Goal | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Play plans"
        title="Pick a Plan, pick a level, press play."
        description={`Every plan is a week-long Play Dose. ${LEVEL_GUIDANCE} All plans use the Fine Motor Play Kit.`}
      />

      <FreePlanBanner goals={goals.data ?? []} />

      {plans.isLoading || goals.isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        (goals.data ?? []).map((goal) => {
          const goalPlans = (plans.data ?? []).filter((p) => p.goalId === goal.id);
          return (
            <section key={goal.id} className="mt-8 first:mt-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn("h-2.5 w-2.5 rounded-[3px]", TOKEN_BG[goal.color])}
                  aria-hidden
                />
                <h2 className="text-lg font-bold">{goal.name}</h2>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-navy/55">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue/20 bg-blue/8 px-3 py-1 text-xs font-bold text-navy">
                  <UserRound className="h-3.5 w-3.5 text-blue" aria-hidden />
                  Created by <span className="text-blue">{goal.createdBy ?? "Super Admin"}</span>
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

              <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
          childId={free.child.id}
          childName={free.child.name}
          onClose={() => setChoosing(null)}
        />
      )}
    </>
  );
}
