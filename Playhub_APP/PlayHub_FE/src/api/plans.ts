import type { Goal, Level, PlanActivity, PlanEntry, PlayPlan, Session } from "@/lib/types";
import { GOALS, PLAY_PLANS, goalById, planById } from "./domain";
import { apiRequest, type ApiActivity, type ApiDose, type ApiPlan } from "./client";
import { flattenPlans, mapGoal } from "./mappers";

export interface EntryState {
  entry: PlanEntry;
  dayUnlocked: boolean;
  entitled: boolean;
  unlockedOn: string;
}

let catalogPromise: Promise<ApiPlan[]> | undefined;

export function invalidatePlanCatalog() {
  catalogPromise = undefined;
}

export async function getApiPlanCatalog(includeInactive = false) {
  if (includeInactive) {
    return apiRequest<ApiPlan[]>("/play-plans?include_inactive=true");
  }
  catalogPromise ??= apiRequest<ApiPlan[]>("/play-plans");
  return catalogPromise;
}

async function loadCatalog(includeInactive = false) {
  const apiPlans = await getApiPlanCatalog(includeInactive);
  const goals = apiPlans.map(mapGoal);
  const plans = flattenPlans(apiPlans);
  GOALS.splice(0, GOALS.length, ...goals);
  PLAY_PLANS.splice(0, PLAY_PLANS.length, ...plans);
  return { apiPlans, goals, plans };
}

export async function listGoals() {
  return (await loadCatalog()).goals;
}

export async function listAllGoals() {
  return (await loadCatalog(true)).goals;
}

export async function listPlans(goalId?: string, includeInactive = false) {
  const plans = (await loadCatalog(includeInactive)).plans;
  return goalId ? plans.filter((plan) => plan.goalId === goalId) : plans;
}

export async function getPlan(planId: string): Promise<PlayPlan | undefined> {
  return (await listPlans()).find((plan) => plan.id === planId);
}

export async function getGoal(goalId: string) {
  return (await listGoals()).find((goal) => goal.id === goalId);
}

function daysSince(dateIso: string) {
  const start = new Date(`${dateIso}T00:00:00`).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - start) / 86_400_000);
}

export function isEntitled(_session: Session, _entry: PlanEntry, _entryIndex: number) {
  // Play Plan content is available to every signed-in account. Subscriptions may
  // control Session logging and billing features, but never Plan, Dose or Activity access.
  return true;
}

export function entryStates(plan: PlayPlan, session: Session, planStartedAt: string): EntryState[] {
  const elapsed = daysSince(planStartedAt);
  return plan.entries.map((entry, index) => {
    // entry.day is 1-indexed ("Day 1" unlocks on the plan's start date itself).
    const unlockDate = new Date(`${planStartedAt}T00:00:00`);
    unlockDate.setDate(unlockDate.getDate() + entry.day - 1);
    return {
      entry,
      dayUnlocked: elapsed >= entry.day - 1,
      entitled: isEntitled(session, entry, index),
      unlockedOn: unlockDate.toISOString().slice(0, 10),
    };
  });
}

export async function getPlanForChild(childId: string) {
  const { getChild } = await import("./children");
  const child = await getChild(childId);
  if (!child) return undefined;
  return { child, plan: await getPlan(child.currentPlanId) };
}

export function nextEntry(states: EntryState[], loggedEntryIds: string[]): EntryState | undefined {
  return (
    states.find(
      (state) =>
        state.entry.loggable &&
        state.dayUnlocked &&
        state.entitled &&
        !loggedEntryIds.includes(state.entry.id),
    ) ?? states.find((state) => state.entry.loggable && state.dayUnlocked && state.entitled)
  );
}

export interface PlanInput {
  title: string;
  goalId: string;
  level: Level;
  kit: string;
  summary: string;
  safetyNote?: string | undefined;
  thumbnailUrl?: string | undefined;
  thumbnailFile?: File | undefined;
  /** Full name credited as the creator; blank keeps or defaults to the current user. */
  createdBy?: string | undefined;
  entries: PlanEntry[];
}

export function planUsageCount(_planId: string) {
  return 0;
}

export async function listPlanUsage(): Promise<Record<string, number>> {
  const [{ getApiChildren }, plans] = await Promise.all([
    import("./client"),
    listPlans(undefined, true),
  ]);
  const children = await getApiChildren();
  return Object.fromEntries(
    plans.map((plan) => [
      plan.id,
      children.filter((child) => child.current_play_dose_id === plan.id).length,
    ]),
  );
}

const levelValues: Record<Level, string> = { Rookie: "rookie", Starter: "starter", Pro: "pro" };
const kindValues: Record<PlanEntry["kind"], string> = {
  intro: "introduction",
  dose: "activity",
  redo: "redo",
  levelup: "level_up",
};

function remoteVideo(url?: string) {
  return url && !url.startsWith("blob:") ? url : null;
}

function activityRows(input: PlanInput) {
  let sequence = 0;
  return input.entries.flatMap((entry) =>
    entryActivities(entry).map((activity) => ({ entry, activity, sequence: sequence++ })),
  );
}

async function saveActivity(
  doseId: string,
  row: ReturnType<typeof activityRows>[number],
  existing?: ApiActivity,
) {
  const payload = {
    sequence: row.sequence,
    day: row.entry.day,
    kind: kindValues[row.entry.kind],
    title: row.activity.name,
    instructions: row.activity.instructions,
    instructions_html: row.activity.instructionsHtml || null,
    video_source_type: remoteVideo(row.activity.videoUrl) ? "link" : null,
    video_url: remoteVideo(row.activity.videoUrl),
    is_loggable: row.entry.loggable,
    is_real_life_try: Boolean(row.entry.isRealLifeTry),
  };
  const saved = existing
    ? await apiRequest<ApiActivity>(`/activities/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
    : await apiRequest<ApiActivity>(`/play-doses/${doseId}/activities`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
  if (row.activity.videoFile) {
    const form = new FormData();
    form.set("file", row.activity.videoFile);
    return apiRequest<ApiActivity>(`/activities/${saved.id}/video`, { method: "POST", body: form });
  }
  return saved;
}

async function uploadThumbnail(doseId: string, file?: File) {
  if (!file) return;
  const form = new FormData();
  form.set("file", file);
  await apiRequest<ApiDose>(`/play-doses/${doseId}/thumbnail`, { method: "POST", body: form });
}

export async function createPlan(input: PlanInput): Promise<PlayPlan> {
  const dose = await apiRequest<ApiDose>(`/play-plans/${input.goalId}/play-doses`, {
    method: "POST",
    body: JSON.stringify({
      level: levelValues[input.level],
      title: input.title,
      summary: input.summary,
      safety_note: input.safetyNote || null,
      thumbnail_url: remoteVideo(input.thumbnailUrl),
      created_by_name: input.createdBy?.trim() || null,
      sort_order:
        levelValues[input.level] === "rookie" ? 0 : levelValues[input.level] === "starter" ? 1 : 2,
    }),
  });
  await Promise.all(activityRows(input).map((row) => saveActivity(dose.id, row)));
  await uploadThumbnail(dose.id, input.thumbnailFile);
  invalidatePlanCatalog();
  return (await getPlan(dose.id))!;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createPlayPlan(input: {
  name: string;
  summary: string;
  createdBy?: string;
}): Promise<Goal> {
  const created = await apiRequest<ApiPlan>("/play-plans", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      slug: `${slugify(input.name)}-${Date.now().toString(36)}`,
      short_description: input.summary.trim(),
      colour: "blue",
      icon: "pinch",
      created_by_name: input.createdBy?.trim() || null,
    }),
  });
  invalidatePlanCatalog();
  await loadCatalog();
  return mapGoal(created);
}

export async function reorderPlayPlans(planIds: string[]) {
  await apiRequest<ApiPlan[]>("/play-plans/order", {
    method: "PUT",
    body: JSON.stringify({ ids: planIds }),
  });
  invalidatePlanCatalog();
}

export async function reorderPlayDoses(planId: string, doseIds: string[]) {
  await apiRequest<ApiPlan>(`/play-plans/${planId}/play-doses/order`, {
    method: "PUT",
    body: JSON.stringify({ ids: doseIds }),
  });
  invalidatePlanCatalog();
}

export async function updatePlayPlanCredit(planId: string, createdBy: string) {
  await apiRequest<ApiPlan>(`/play-plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify({ created_by_name: createdBy.trim() || null }),
  });
  invalidatePlanCatalog();
}

export type PlanPublicationStatus = "published" | "invisible" | "locked";

export async function updatePlayPlanStatus(
  planId: string,
  publicationStatus: PlanPublicationStatus,
) {
  await apiRequest<ApiPlan>(`/play-plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify({ publication_status: publicationStatus }),
  });
  invalidatePlanCatalog();
}

export async function updatePlan(planId: string, input: PlanInput): Promise<PlayPlan | undefined> {
  const catalog = await getApiPlanCatalog(true);
  const existing = catalog.flatMap((plan) => plan.play_doses).find((dose) => dose.id === planId);
  if (!existing) return undefined;
  await apiRequest<ApiDose>(`/play-doses/${planId}`, {
    method: "PATCH",
    body: JSON.stringify({
      level: levelValues[input.level],
      title: input.title,
      summary: input.summary,
      safety_note: input.safetyNote || null,
      thumbnail_url: input.thumbnailFile ? existing.thumbnail_url : remoteVideo(input.thumbnailUrl),
      created_by_name: input.createdBy?.trim() || null,
    }),
  });

  const rows = activityRows(input);
  // Free the dose's unique sequence slots before applying a reorder.
  await Promise.all(
    existing.activities.map((activity, index) =>
      apiRequest<ApiActivity>(`/activities/${activity.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sequence: 10_000 + index }),
      }),
    ),
  );
  const retained = new Set<string>();
  for (const row of rows) {
    const current = existing.activities.find((activity) => activity.id === row.activity.id);
    const saved = await saveActivity(planId, row, current);
    retained.add(saved.id);
  }
  await Promise.all(
    existing.activities
      .filter((activity) => !retained.has(activity.id))
      .map((activity) => apiRequest<void>(`/activities/${activity.id}`, { method: "DELETE" })),
  );
  await uploadThumbnail(planId, input.thumbnailFile);
  invalidatePlanCatalog();
  return getPlan(planId);
}

export interface DeletePlanResult {
  ok: boolean;
  inUse: number;
}

export async function deletePlan(planId: string): Promise<DeletePlanResult> {
  const usage = (await listPlanUsage())[planId] ?? 0;
  if (usage) return { ok: false, inUse: usage };
  await apiRequest<void>(`/play-doses/${planId}`, { method: "DELETE" });
  invalidatePlanCatalog();
  return { ok: true, inUse: 0 };
}

export function blankPlanEntries(): PlanEntry[] {
  const seed = Date.now().toString(36);
  return [
    {
      id: `new-${seed}-dose-1`,
      kind: "dose",
      day: 0,
      label: "Activity #1",
      title: "",
      activity: "",
      loggable: true,
      minutes: 10,
      instructions: [],
      videoLabel: "",
      activities: [
        {
          id: `new-${seed}-act-1`,
          name: "",
          minutes: 10,
          instructions: [""],
          videoLabel: "",
        },
      ],
    },
  ];
}

export function entryActivities(entry: PlanEntry): PlanActivity[] {
  if (entry.activities?.length) return entry.activities;
  return [
    {
      id: `${entry.id}-activity`,
      name: entry.activity,
      minutes: entry.minutes,
      instructions: entry.instructions,
      videoLabel: entry.videoLabel,
      videoUrl: entry.videoUrl,
    },
  ];
}

export { goalById, planById };

export async function updatePlayPlanDetails(
  planId: string,
  values: { name: string; short: string; blurb: string; createdBy: string },
) {
  await apiRequest<ApiPlan>(`/play-plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: values.name,
      short_description: values.short,
      description: values.blurb,
      created_by_name: values.createdBy,
    }),
  });
  invalidatePlanCatalog();
}
