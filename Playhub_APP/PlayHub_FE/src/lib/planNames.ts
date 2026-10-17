/**
 * Play Hub naming: a category ("Pinch & Grip Development") holds one Play Plan ("Fix the Pencil
 * Grip"), and the plan has a Play Dose at each level (Rookie, Starter, Pro). Filters show the
 * Play Plan's name, which every dose of the plan shares as its title.
 */
export function playPlanName(
  goal: { id: string; name: string },
  doses: readonly { goalId: string; title: string }[],
) {
  return doses.find((dose) => dose.goalId === goal.id && dose.title.trim())?.title ?? goal.name;
}
