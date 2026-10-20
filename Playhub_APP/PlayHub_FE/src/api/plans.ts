import type { Goal, Level, PlanActivity, PlanEntry, PlayPlan, Session } from "@/lib/types";
import { GOALS, PLAY_PLANS, goalById, planById } from "./domain";
import { apiAssetUrl, apiRequest, type ApiActivity, type ApiDose, type ApiPlan } from "./client";
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
  catalogPromise ??= apiRequest<ApiPlan[]>("/play-plans").catch((error) => {
    catalogPromise = undefined;
    throw error;
  });
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
  return input.entries.flatMap((entry) =>
    entryActivities(entry).map((activity) => ({ entry, activity })),
  );
}

type ActivityRow = ReturnType<typeof activityRows>[number];

/**
 * The video part of a save. An untouched video is kept exactly as stored (so an uploaded file is
 * never re-sent as a link and deleted); a file waiting to upload keeps the old video until it
 * replaces it.
 */
function videoFields(activity: PlanActivity) {
  if (activity.videoFile) return { keep_video: true };
  const url = activity.videoUrl?.trim() || undefined;
  if (url === (apiAssetUrl(activity.videoPath) || undefined)) return { keep_video: true };
  const link = remoteVideo(url);
  return {
    keep_video: false,
    video_source_type: link ? "link" : null,
    video_url: link,
  };
}

function activityFields({ entry, activity }: ActivityRow) {
  return {
    day: entry.day,
    kind: kindValues[entry.kind],
    title: activity.name,
    instructions: activity.instructions,
    instructions_html: activity.instructionsHtml || null,
    is_loggable: entry.loggable,
    is_real_life_try: Boolean(entry.isRealLifeTry),
  };
}

function doseFields(input: PlanInput) {
  return {
    level: levelValues[input.level],
    title: input.title,
    summary: input.summary,
    safety_note: input.safetyNote || null,
    // A new thumbnail file replaces the current one after the save.
    ...(input.thumbnailFile ? {} : { thumbnail_url: remoteVideo(input.thumbnailUrl) }),
    created_by_name: input.createdBy?.trim() || null,
  };
}

async function uploadVideo(activityId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  return apiRequest<ApiActivity>(`/activities/${activityId}/video`, { method: "POST", body: form });
}

async function uploadThumbnail(doseId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  return apiRequest<ApiDose>(`/play-doses/${doseId}/thumbnail`, { method: "POST", body: form });
}

/** A file that couldn't upload after the rest of the Play Dose was saved. */
export interface UploadProblem {
  /** The activity's position in the saved list; undefined for the thumbnail. */
  index?: number;
  name: string;
  message: string;
}

export interface DoseSaveResult {
  doseId: string;
  /** The saved activities in editor order, with their server ids and stored videos. */
  activities: ApiActivity[];
  /** The thumbnail as now stored. */
  thumbnailUrl?: string | undefined;
  problems: UploadProblem[];
}

const problemMessage = (error: unknown) =>
  error instanceof Error ? error.message : "The upload didn't finish.";

/** Upload files one at a time so a slow connection isn't split across several large uploads. */
async function uploadFiles(
  doseId: string,
  rows: ActivityRow[],
  saved: ApiActivity[],
  thumbnail?: File,
) {
  const problems: UploadProblem[] = [];
  for (const [index, row] of rows.entries()) {
    const file = row.activity.videoFile;
    const target = saved[index];
    if (!file || !target) continue;
    try {
      saved[index] = await uploadVideo(target.id, file);
    } catch (error) {
      problems.push({
        index,
        name: row.activity.name || `Activity ${index + 1}`,
        message: problemMessage(error),
      });
    }
  }
  let thumbnailUrl: string | null | undefined;
  if (thumbnail) {
    try {
      thumbnailUrl = (await uploadThumbnail(doseId, thumbnail)).thumbnail_url;
    } catch (error) {
      problems.push({ name: "Thumbnail", message: problemMessage(error) });
    }
  }
  return { problems, thumbnailUrl };
}

/**
 * Save a Play Dose's details and its whole activity list in one request (all of it is saved, or
 * none of it), then upload any new video or thumbnail files.
 */
export async function saveDoseContent(doseId: string, input: PlanInput): Promise<DoseSaveResult> {
  const rows = activityRows(input);
  const dose = await apiRequest<ApiDose>(`/play-doses/${doseId}/content`, {
    method: "PUT",
    body: JSON.stringify({
      dose: doseFields(input),
      activities: rows.map((row) => ({
        ...(row.activity.persisted ? { id: row.activity.id } : {}),
        ...activityFields(row),
        ...videoFields(row.activity),
      })),
    }),
  });
  const activities = [...dose.activities];
  const uploaded = await uploadFiles(doseId, rows, activities, input.thumbnailFile);
  invalidatePlanCatalog();
  return {
    doseId,
    activities,
    thumbnailUrl: apiAssetUrl(uploaded.thumbnailUrl ?? dose.thumbnail_url),
    problems: uploaded.problems,
  };
}

/** Create an empty Play Dose; its activities are then saved with saveDoseContent. */
export async function createDose(input: PlanInput): Promise<string> {
  const dose = await apiRequest<ApiDose>(`/play-plans/${input.goalId}/play-doses`, {
    method: "POST",
    body: JSON.stringify({
      ...doseFields(input),
      thumbnail_url: remoteVideo(input.thumbnailUrl),
      sort_order:
        levelValues[input.level] === "rookie" ? 0 : levelValues[input.level] === "starter" ? 1 : 2,
    }),
  });
  return dose.id;
}

/**
 * Save one activity of an existing Play Dose on its own. A new activity is added after the last
 * one; the Play Dose's Save puts everything in its final order.
 */
export async function saveOneActivity(
  doseId: string,
  entry: PlanEntry,
  activity: PlanActivity,
): Promise<{ activity: ApiActivity; problem?: string | undefined }> {
  const row = { entry, activity };
  const video = videoFields(activity);
  const body = {
    ...activityFields(row),
    ...(video.keep_video
      ? {}
      : { video_source_type: video.video_source_type, video_url: video.video_url }),
  };
  let saved = activity.persisted
    ? await apiRequest<ApiActivity>(`/activities/${activity.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
    : await apiRequest<ApiActivity>(`/play-doses/${doseId}/activities`, {
        method: "POST",
        body: JSON.stringify(body),
      });
  let problem: string | undefined;
  if (activity.videoFile) {
    try {
      saved = await uploadVideo(saved.id, activity.videoFile);
    } catch (error) {
      problem = problemMessage(error);
    }
  }
  invalidatePlanCatalog();
  return { activity: saved, problem };
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
