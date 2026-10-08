import type { Child, Session } from "@/lib/types";
import { apiRequest, getApiChildren, type ApiChild } from "./client";
import { dateOfBirthForAge, mapChild } from "./mappers";

export async function listChildrenForSession(_session: Session): Promise<Child[]> {
  return (await getApiChildren()).filter((child) => child.is_active).map(mapChild);
}

export async function getChild(childId: string) {
  const child = (await getApiChildren()).find((item) => item.id === childId);
  return child ? mapChild(child) : undefined;
}

export interface NewChildInput {
  name: string;
  age: number;
  planId: string;
  note?: string | undefined;
  parentEmail?: string | undefined;
  orgId?: string | undefined;
  educatorId?: string | undefined;
  accountType: "b2c" | "b2b";
  ownerUserId: string;
}

export async function createChild(input: NewChildInput): Promise<Child> {
  const palette = ["coral", "blue", "amber"] as const;
  const current = await getApiChildren();
  const child = await apiRequest<ApiChild>("/children", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      date_of_birth: dateOfBirthForAge(input.age),
      colour_token: palette[current.length % palette.length],
      account_scope: input.accountType === "b2b" ? "organisation" : "individual",
      organisation_id: input.orgId ?? null,
      owner_id: input.accountType === "b2c" ? input.ownerUserId : null,
      admin_id: input.educatorId ?? input.ownerUserId,
      current_play_dose_id: input.planId,
      plan_started_at: new Date().toISOString().slice(0, 10),
      notes: input.note ?? null,
    }),
  });
  return mapChild(child);
}

export async function assignSupporter(childId: string, supporterId: string | undefined) {
  const child = await apiRequest<ApiChild>(`/children/${childId}`, {
    method: "PATCH",
    body: JSON.stringify({ moderator_id: supporterId ?? null }),
  });
  return mapChild(child);
}

/** A free family opens one Play Plan (goal) for this child; it can't be changed afterwards. */
export async function chooseFreePlan(childId: string, goalId: string) {
  const child = await apiRequest<ApiChild>(`/children/${childId}/free-play-plan`, {
    method: "PUT",
    body: JSON.stringify({ play_plan_id: goalId }),
  });
  return mapChild(child);
}

export async function setChildPlan(childId: string, planId: string) {
  const child = await apiRequest<ApiChild>(`/children/${childId}`, {
    method: "PATCH",
    body: JSON.stringify({
      current_play_dose_id: planId,
      plan_started_at: new Date().toISOString().slice(0, 10),
    }),
  });
  return mapChild(child);
}

export interface ChildEditInput {
  name?: string;
  age?: number;
  planId?: string;
  note?: string | undefined;
  parentEmail?: string | undefined;
  orgId?: string | null | undefined;
  ownerUserId?: string | null | undefined;
  educatorId?: string | null | undefined;
  moderatorId?: string | null | undefined;
}

export async function updateChild(childId: string, input: ChildEditInput) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload["name"] = input.name;
  if (input.age !== undefined) payload["date_of_birth"] = dateOfBirthForAge(input.age);
  if (input.note !== undefined) payload["notes"] = input.note || null;
  if (input.orgId !== undefined) {
    payload["organisation_id"] = input.orgId || null;
    payload["account_scope"] = input.orgId ? "organisation" : "individual";
  }
  if (input.educatorId !== undefined) payload["admin_id"] = input.educatorId || null;
  if (input.ownerUserId !== undefined) payload["owner_id"] = input.ownerUserId || null;
  if (input.moderatorId !== undefined) payload["moderator_id"] = input.moderatorId || null;
  if (input.planId !== undefined) {
    payload["current_play_dose_id"] = input.planId;
    payload["plan_started_at"] = new Date().toISOString().slice(0, 10);
  }
  const child = await apiRequest<ApiChild>(`/children/${childId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapChild(child);
}
