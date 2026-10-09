import { useCapabilities } from "@/auth/session";
import { useActiveChild } from "@/lib/active-child";
import type { Goal, PlayPlan } from "@/lib/types";

export type FreeAccess = "open" | "choose" | "subscribe";

/**
 * A family on the free tier chooses one Play Plan for each child and opens its first Play Dose
 * (Rookie); every other dose and plan shows its name and summary only until they subscribe.
 * Organisation and subscribed families see everything.
 */
export function useFreePlan() {
  const { isFreeGated, canManageSubscription } = useCapabilities();
  const { activeChild } = useActiveChild();
  const active = isFreeGated && !!activeChild;
  const chosenGoalId = active ? activeChild.freePlanGoalId : undefined;
  const canChoose = active && !chosenGoalId && canManageSubscription;

  const accessFor = (
    goal: Pick<Goal, "id" | "accessLocked">,
    dose?: Pick<PlayPlan, "accessLocked" | "isFreeDose">,
  ): FreeAccess => {
    const doseLocked = !!dose?.accessLocked;
    if (!active) return goal.accessLocked || doseLocked ? "subscribe" : "open";
    if (goal.id === chosenGoalId) return doseLocked ? "subscribe" : "open";
    // Choosing a plan opens its first Play Dose, so only that dose offers the choice.
    return canChoose && (!dose || dose.isFreeDose) ? "choose" : "subscribe";
  };

  return { active, child: activeChild, chosenGoalId, canChoose, canManageSubscription, accessFor };
}
