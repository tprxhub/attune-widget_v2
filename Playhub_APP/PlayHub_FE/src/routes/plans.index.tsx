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
import { Gift, Lock, PenLine } from "lucide-react";
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
          "Choose a Play Plan and its Rookie, Starter or Pro dose. Each dose is a week-long programme.",
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
  const [choosing, setChoosing] = useState<Goal | null>(null);
  const categories: { id: string; name: string; createdBy: string | undefined; plans: Goal[] }[] =
    [];
  for (const goal of goals.data ?? []) {
    const id = goal.categoryId ?? goal.id;
    const category = categories.find((item) => item.id === id);
    if (category) {
      category.plans.push(goal);
    } else {
      categories.push({
        id,
        name: goal.categoryName ?? goal.name,
        createdBy: goal.categoryCreatedBy,
        plans: [goal],
      });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Play plans"
        title="Choose a Play Plan and its dose."
        description="Choose a category, then a Play Plan and its Rookie, Starter or Pro Play Dose. Begin with Starter; try Rookie if it is difficult, or Pro when your member is ready."
      />

      <FreePlanBanner goals={goals.data ?? []} plans={plans.data ?? []} />

      {plans.isLoading || goals.isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        categories.map((category) => {
          return (
            <section key={category.id} className="mt-8 first:mt-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-[3px]",
                      TOKEN_BG[category.plans[0]?.color ?? "blue"],
                    )}
                    aria-hidden
                  />
                  <h2 className="text-lg font-bold">{category.name}</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white/70 px-3 py-1.5 text-xs text-navy/60">
                  <PenLine className="h-3.5 w-3.5 text-blue" aria-hidden />
                  <span>Created by</span>
                  <span className="font-semibold text-navy">
                    {category.createdBy ?? "Super Admin"}
                  </span>
                </span>
              </div>
              {category.plans.map((goal) => {
                const doses = (plans.data ?? []).filter((dose) => dose.goalId === goal.id);
                return (
                  <div key={goal.id} className="mt-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {category.plans.length > 1 && (
                        <h3 className="text-base font-bold text-navy">{goal.name}</h3>
                      )}
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
                    <ul className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {doses.map((dose) => (
                        <li key={dose.id}>
                          <PlayPlanCard
                            plan={dose}
                            goal={goal}
                            access={free.accessFor(goal, dose)}
                            onChoose={() => setChoosing(goal)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })
      )}

      {choosing && free.child && (
        <ChooseFreePlanDialog
          goal={choosing}
          planTitle={choosing.name}
          childId={free.child.id}
          childName={free.child.name}
          onClose={() => setChoosing(null)}
        />
      )}
    </>
  );
}
