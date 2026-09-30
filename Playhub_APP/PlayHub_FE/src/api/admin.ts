import type { Org, StaffMember } from "@/lib/types";
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
  role: "super_admin" | "admin" | "moderator" | "member";
  account_scope: "platform" | "organisation" | "individual";
  organisation_id: string | null;
  child_id: string | null;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  created_at: string;
  acceptance_token?: string | null;
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

export async function platformOverview(scope = "all") {
  const [orgs, staff, children] = await Promise.all([listOrgs(), staffData(), getApiChildren()]);
  const subscriberId = scope.startsWith("subscriber:")
    ? scope.slice("subscriber:".length)
    : undefined;
  const inScope = (orgId?: string | null) =>
    scope === "all"
      ? true
      : scope === "b2b"
        ? Boolean(orgId)
        : scope === "individual"
          ? !orgId
          : subscriberId
            ? false
            : orgId === scope;
  const scopedChildren = children.filter((child) =>
    subscriberId ? child.id === subscriberId : inScope(child.organisation_id),
  );
  const scopedStaff = staff.filter((member) => inScope(member.orgId));
  const scopedOrgs =
    scope === "all" || scope === "b2b"
      ? orgs
      : scope === "individual" || subscriberId
        ? []
        : orgs.filter((org) => org.id === scope);
  const wantedChildren = new Set(scopedChildren.map((child) => child.id));
  const progress = (await apiRequest<ApiProgress[]>("/admin/progress")).filter((summary) =>
    wantedChildren.has(summary.child_id),
  );
  const totalAttempts = progress.reduce((sum, summary) => sum + summary.total_attempts, 0);
  const last30 = progress
    .flatMap((summary) => summary.points)
    .filter((point) => Date.now() - new Date(point.occurred_on).getTime() < 30 * 86_400_000).length;
  return {
    orgs: scopedOrgs.length,
    activeOrgs: scopedOrgs.filter((org) => org.active).length,
    educators: scopedStaff.filter((member) => member.role === "educator").length,
    supporters: scopedStaff.filter((member) => member.role === "supporter").length,
    childrenTotal: scopedChildren.length,
    b2cChildren: scopedChildren.filter((child) => child.account_scope === "individual").length,
    b2bChildren: scopedChildren.filter((child) => child.account_scope === "organisation").length,
    activeSubs: scopedChildren.filter((child) => child.subscription?.status === "active").length,
    totalAttempts,
    attemptsLast30: last30,
  };
}
