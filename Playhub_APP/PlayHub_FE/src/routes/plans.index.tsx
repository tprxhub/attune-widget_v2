import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listGoals, listPlans } from "@/api/plans";
import { LEVEL_GUIDANCE } from "@/api/domain";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { PlayPlanCard } from "@/components/PlayPlanCard";
import { ListSkeleton } from "@/components/Skeletons";
import { TOKEN_BG } from "@/components/brand";
import { cn } from "@/lib/utils";

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
    <Protected>
      <PlansPage />
    </Protected>
  ),
});

function PlansPage() {
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoals });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => listPlans() });

  return (
    <>
      <PageHeader
        eyebrow="Play plans"
        title="Pick a Plan, pick a level, press play."
        description={`Every plan is a week-long Play Dose. ${LEVEL_GUIDANCE} All plans use the Fine Motor Play Kit.`}
      />

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
              <p className="mt-0.5 text-sm text-navy/55">
                Best paired with the {goal.kit} · Created by {goal.createdBy ?? "Play Hub team"}
              </p>

              <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {goalPlans.map((plan) => (
                  <li key={plan.id}>
                    <PlayPlanCard plan={plan} goal={goal} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
