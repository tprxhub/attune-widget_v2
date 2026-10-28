/**
 * A Category can hold several Play Plans; each plan can have a Play Dose at each level.
 * Display the Play Plan name, not the title of one of its Play Doses.
 */
export function playPlanName(goal: { name: string }) {
  return goal.name;
}
