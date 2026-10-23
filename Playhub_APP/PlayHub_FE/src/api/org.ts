import type { Child, Org, StaffMember } from "@/lib/types";
import { apiRequest, getApiChildren, type ApiOrganisation, type ApiUser } from "./client";
import {
  createStaffInvitation,
  deleteStaffInvitation,
  listStaff,
  regenerateStaffActivation,
  updateModeratorInvitation,
} from "./admin";
import { mapOrganisation, mapStaff } from "./mappers";

export async function getOrg(orgId: string): Promise<Org | undefined> {
  return mapOrganisation(await apiRequest<ApiOrganisation>(`/organisations/${orgId}`));
}

export async function listSupporters(orgId?: string): Promise<StaffMember[]> {
  return (await listStaff()).filter(
    (staff) => staff.role === "supporter" && (!orgId || staff.orgId === orgId),
  );
}

export async function createSupporter(input: {
  name: string;
  email: string;
  orgId?: string | undefined;
  childId?: string | undefined;
}) {
  return createStaffInvitation({ ...input, role: "moderator" });
}

export async function regenerateSupporterActivation(supporterId: string) {
  return regenerateStaffActivation(supporterId);
}

export async function editSupporterInvitation(
  supporterId: string,
  input: { name: string; email: string; childId?: string },
) {
  return updateModeratorInvitation(supporterId, input);
}

export async function deleteSupporterInvitation(supporterId: string) {
  return deleteStaffInvitation(supporterId);
}

export async function inviteParent(childId: string, email: string) {
  const child = (await getApiChildren()).find((item) => item.id === childId);
  if (!child) throw new Error("Member not found");
  const invitation = await apiRequest<{ created_at: string }>("/invitations", {
    method: "POST",
    body: JSON.stringify({
      email,
      role: "member",
      account_scope: child.account_scope,
      organisation_id: child.organisation_id,
      child_id: childId,
    }),
  });
  return { childId, email, sentAt: invitation.created_at, status: "invited" as const };
}

export async function getOrgBilling(orgId: string) {
  const org = await getOrg(orgId);
  if (!org) return undefined;
  return {
    org,
    licensePrice: org.licensePrice,
    licenses: org.licenses,
    licensesUsed: org.licensesUsed,
    cycle: org.billingCycle,
    amount: 0,
    nextInvoice: null,
    invoices: [],
  };
}

export async function toggleSupporterActive(supporterId: string) {
  if (supporterId.startsWith("invitation:")) {
    throw new Error("This invitation has not been accepted yet.");
  }
  const [users, children] = await Promise.all([apiRequest<ApiUser[]>("/users"), getApiChildren()]);
  const current = users.find((user) => user.id === supporterId);
  if (!current) return undefined;
  const user = await apiRequest<ApiUser>(`/users/${supporterId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: !current.is_active }),
  });
  return mapStaff(user, children) ?? undefined;
}

/**
 * Super Admin: set a member's email. With a Member account linked it changes that account's
 * sign-in email; otherwise it invites that email to become the member's Member account.
 */
export async function saveMemberEmail(
  child: Pick<Child, "id" | "memberUserId" | "parentEmail">,
  email: string,
) {
  if (child.memberUserId && child.parentEmail) {
    await apiRequest<ApiUser>(`/users/${child.memberUserId}`, {
      method: "PATCH",
      body: JSON.stringify({ email }),
    });
    return;
  }
  await inviteParent(child.id, email);
}
