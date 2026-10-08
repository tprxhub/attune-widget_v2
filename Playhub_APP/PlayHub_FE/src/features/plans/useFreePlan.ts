import { useCapabilities } from "@/auth/session";
import { useActiveChild } from "@/lib/active-child";
import type { Goal } from "@/lib/types";

export type FreeAccess = "open" | "choose" | "subscribe";

/**
 * A family on the free tier opens one Play Plan of their choice for each child; every other plan
 * shows its name and summary only until they subscribe. Organisation and subscribed families see
 * everything.
 */
export function useFreePlan() {
  const { isFreeGated, canManageSubscription } = useCapabilities();
  const { activeChild } = useActiveChild();
  const active = isFreeGated && !!activeChild;
  const chosenGoalId = active ? activeChild.freePlanGoalId : undefined;
  const canChoose = active && !chosenGoalId && canManageSubscription;

  const accessFor = (goal: Pick<Goal, "id" | "accessLocked">): FreeAccess => {
    if (!active) return goal.accessLocked ? "subscribe" : "open";
    if (goal.id === chosenGoalId) return "open";
    return canChoose ? "choose" : "subscribe";
  };

  return { active, child: activeChild, chosenGoalId, canChoose, canManageSubscription, accessFor };
}
