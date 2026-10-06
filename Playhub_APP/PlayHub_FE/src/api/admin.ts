import type { Org, PermissionKey, StaffMember } from "@/lib/types";
import {
  apiRequest,
  getApiChildren,
  type ApiOrganisation,
  type ApiProgress,
  type ApiUser,
} from "./client";
import { mapOrganisation, mapStaff } from "./mappers";

interface ApiInvitation {
  id: string;
  email: string;
  display_name: string | null;
  role: "super_admin" | "ttp_employee" | "admin" | "moderator" | "member";
  account_scope: "platform" | "organisation" | "individual";
  organisation_id: string | null;
  child_id: string | null;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  created_at: string;
  acceptance_token?: string | null;
  permissions?: string[];
}

export interface StaffInvitationResult {
  member: StaffMember;
  credentials: {
    email: string;
    acceptanceToken: string | null;
    expiresAt: string;
  };
}

function pendingStaff(invite: ApiInvitation): StaffMember | null {
  if (invite.status !== "pending" || (invite.role !== "admin" && invite.role !== "moderator")) {
    return null;
  }
  return {
    id: `invitation:${invite.id}`,
    name: invite.display_name ?? invite.email,
    email: invite.email,
    role: invite.role === "admin" ? "educator" : "supporter",
    orgId: invite.organisation_id ?? undefined,
    active: false,
    invitationPending: true,
    createdAt: invite.created_at.slice(0, 10),
    childCount: invite.child_id ? 1 : 0,
  };
}

export async function listOrgs(): Promise<Org[]> {
  const [orgs, children] = await Promise.all([
    apiRequest<ApiOrganisation[]>("/organisations"),
    getApiChildren(),
  ]);
  return orgs.map((org) =>
    mapOrganisation(org, children.filter((child) => child.organisation_id === org.id).length),
  );
}

export async function createOrg(input: {
  name: string;
  kind: "School" | "Clinic";
  licenses: number;
  licensePrice: number;
}) {
  const org = await apiRequest<ApiOrganisation>("/organisations", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      kind: input.kind.toLowerCase(),
      seat_limit: input.licenses,
      billing_cycle: "annual",
    }),
  });
  return mapOrganisation(org);
}

export async function updateOrgLicenses(orgId: string, licenses: number) {
  const org = await apiRequest<ApiOrganisation>(`/organisations/${orgId}`, {
    method: "PATCH",
    body: JSON.stringify({ seat_limit: licenses }),
  });
  return mapOrganisation(org);
}

export async function toggleOrgActive(orgId: string) {
  const current = (await listOrgs()).find((org) => org.id === orgId);
  if (!current) return undefined;
  const org = await apiRequest<ApiOrganisation>(`/organisations/${orgId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: !current.active }),
  });
  return mapOrganisation(org, current.licensesUsed);
}

async function staffData() {
  const [users, children, invitations] = await Promise.all([
    apiRequest<ApiUser[]>("/users"),
    getApiChildren(),
    apiRequest<ApiInvitation[]>("/invitations"),
  ]);
  return [
    ...users.map((user) => mapStaff(user, children)).filter((user): user is StaffMember => !!user),
    ...invitations.map(pendingStaff).filter((member): member is StaffMember => !!member),
  ];
}

function invitationResult(invitation: ApiInvitation): StaffInvitationResult {
  return {
    member: pendingStaff(invitation)!,
    credentials: {
      email: invitation.email,
      acceptanceToken: invitation.acceptance_token ?? null,
      expiresAt: invitation.expires_at,
    },
  };
}

export async function createStaffInvitation(input: {
  name: string;
  email: string;
  orgId?: string | undefined;
  role: "admin" | "moderator";
  childId?: string | undefined;
}): Promise<StaffInvitationResult> {
  const invitation = await apiRequest<ApiInvitation>("/invitations", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      display_name: input.name,
      role: input.role,
      account_scope: input.orgId ? "organisation" : "individual",
      organisation_id: input.orgId ?? null,
      child_id: input.childId ?? null,
    }),
  });
  return invitationResult(invitation);
}

export async function regenerateStaffActivation(staffId: string): Promise<StaffInvitationResult> {
  if (!staffId.startsWith("invitation:")) {
    throw new Error("This account is already activated.");
  }
  const invitationId = staffId.slice("invitation:".length);
  const invitation = await apiRequest<ApiInvitation>(`/invitations/${invitationId}/activation`, {
    method: "POST",
  });
  return invitationResult(invitation);
}

export async function listEducators(): Promise<StaffMember[]> {
  return (await staffData()).filter((staff) => staff.role === "educator");
}

export async function createEducator(input: {
  name: string;
  email: string;
  orgId?: string | undefined;
}) {
  return createStaffInvitation({ ...input, role: "admin" });
}

export async function listStaff(): Promise<StaffMember[]> {
  return staffData();
}

export async function listStaffByOrg(): Promise<{ org: Org | null; members: StaffMember[] }[]> {
  const [orgs, staff] = await Promise.all([listOrgs(), staffData()]);
  const groups = orgs.map((org) => ({
    org,
    members: staff.filter((item) => item.orgId === org.id),
  }));
  const unassigned = staff.filter(
    (item) => !item.orgId || !orgs.some((org) => org.id === item.orgId),
  );
  return [...groups, ...(unassigned.length ? [{ org: null, members: unassigned }] : [])];
}

export async function toggleStaffActive(staffId: string): Promise<StaffMember | undefined> {
  if (staffId.startsWith("invitation:")) {
    throw new Error("Pending invitations do not have an account to disable.");
  }
  const [users, children] = await Promise.all([apiRequest<ApiUser[]>("/users"), getApiChildren()]);
  const current = users.find((user) => user.id === staffId);
  if (!current) return undefined;
  const updated = await apiRequest<ApiUser>(`/users/${staffId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: !current.is_active }),
  });
  return mapStaff(updated, children) ?? undefined;
}

export interface TtpEmployee {
  /** The user id, or `invitation:<id>` while the invitation is still pending. */
  id: string;
  name: string;
  email: string;
  permissions: PermissionKey[];
  active: boolean;
  pending: boolean;
  createdAt: string;
}

export interface TtpInvitationResult {
  employee: TtpEmployee;
  credentials: { email: string; acceptanceToken: string | null; expiresAt: string };
}

const ttpFromUser = (user: ApiUser): TtpEmployee => ({
  id: user.id,
  name: user.display_name,
  email: user.email,
  permissions: (user.permissions ?? []) as PermissionKey[],
  active: user.is_active,
  pending: false,
  createdAt: user.created_at.slice(0, 10),
});

const ttpFromInvitation = (invite: ApiInvitation): TtpEmployee => ({
  id: `invitation:${invite.id}`,
  name: invite.display_name ?? invite.email,
  email: invite.email,
  permissions: (invite.permissions ?? []) as PermissionKey[],
  active: false,
  pending: true,
  createdAt: invite.created_at.slice(0, 10),
});

const ttpResult = (invite: ApiInvitation): TtpInvitationResult => ({
  employee: ttpFromInvitation(invite),
  credentials: {
    email: invite.email,
    acceptanceToken: invite.acceptance_token ?? null,
    expiresAt: invite.expires_at,
  },
});

export async function listTtpEmployees(): Promise<TtpEmployee[]> {
  const [users, invitations] = await Promise.all([
    apiRequest<ApiUser[]>("/users"),
    apiRequest<ApiInvitation[]>("/invitations"),
  ]);
  return [
    ...users.filter((user) => user.role === "ttp_employee").map(ttpFromUser),
    ...invitations
      .filter((invite) => invite.role === "ttp_employee" && invite.status === "pending")
      .map(ttpFromInvitation),
  ];
}

export async function createTtpEmployee(input: {
  name: string;
  email: string;
  permissions: PermissionKey[];
}): Promise<TtpInvitationResult> {
  const invitation = await apiRequest<ApiInvitation>("/invitations", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      display_name: input.name,
      role: "ttp_employee",
      account_scope: "platform",
      organisation_id: null,
      permissions: input.permissions,
    }),
  });
  return ttpResult(invitation);
}

export async function updateTtpPermissions(userId: string, permissions: PermissionKey[]) {
  return ttpFromUser(
    await apiRequest<ApiUser>(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    }),
  );
}

export async function setTtpActive(userId: string, active: boolean) {
  return ttpFromUser(
    await apiRequest<ApiUser>(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: active }),
    }),
  );
}

export async function regenerateTtpActivation(employeeId: string): Promise<TtpInvitationResult> {
  const invitationId = employeeId.replace(/^invitation:/, "");
  return ttpResult(
    await apiRequest<ApiInvitation>(`/invitations/${invitationId}/activation`, { method: "POST" }),
  );
}

/** Areas of the platform a Super Admin or TTP employee can see on the Overview. */
export type OverviewArea =
  "children" | "progress" | "organisations" | "team" | "billing" | "plans" | "audit" | "homepage";

interface OverviewChildRef {
  id: string;
  name: string;
  organisation: string | null;
  last_check_in: string | null;
}

interface OverviewOrgRef {
  id: string;
  name: string;
  used: number;
  limit: number;
  is_active: boolean;
  created_at: string;
}

/**
 * Key figures for the platform Overview, worked out on the server. A section the person has no
 * access to is null, so restricted numbers never reach the browser.
 */
export interface AdminOverview {
  generated_at: string;
  scope: string;
  access: Record<OverviewArea, boolean>;
  children: {
    total: number;
    individual: number;
    organisation: number;
    new_30d: number;
    active_14d: number;
    inactive_14d: number;
    never_logged: number;
    without_moderator: number;
  } | null;
  progress: {
    sessions_7d: number;
    sessions_30d: number;
    sessions_prev_30d: number;
    finished_rate_30d: number | null;
    weekly: { week_start: string; sessions: number }[];
    statuses: Record<string, number>;
    needs_consult: OverviewChildRef[];
  } | null;
  organisations: {
    total: number;
    active: number;
    suspended: number;
    seats_used: number;
    seats_total: number;
    near_capacity: OverviewOrgRef[];
    newest: OverviewOrgRef[];
  } | null;
  team: {
    admins: number;
    moderators: number;
    pending_invitations: number;
    expired_invitations: number;
    moderator_load: { name: string; children: number }[];
  } | null;
  billing: {
    currency: string;
    active: number;
    ending_14d: number;
    ended_30d: number;
    free_families: number;
    paid_30d: number;
    by_plan: Record<string, number>;
  } | null;
  plans: {
    plans: number;
    published: number;
    invisible: number;
    locked: number;
    doses: number;
    activities: number;
    activities_without_video: number;
    most_followed: { name: string; children: number }[];
  } | null;
  audit: { recent: { action: string; actor_name: string | null; created_at: string }[] } | null;
  homepage: { updated_at: string | null; updated_by: string | null } | null;
}

export function getAdminOverview(scope = "all") {
  return apiRequest<AdminOverview>(`/admin/overview?scope=${encodeURIComponent(scope)}`);
}
