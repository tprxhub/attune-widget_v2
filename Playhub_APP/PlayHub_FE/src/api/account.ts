import type { AvatarSticker, Session } from "@/lib/types";
import {
  apiAssetUrl,
  apiRequest,
  getApiChildren,
  getCurrentUser,
  type ApiOrganisation,
  type ApiUser,
} from "./client";

export interface AccountProfile {
  userId: string;
  name: string;
  guardianName: string | null;
  email: string;
  avatarUrl: string | null;
  avatarSticker: AvatarSticker | null;
  role: Session["role"];
  accountType: Session["accountType"];
  tier: Session["tier"];
  orgName: string | null;
  orgKind: string | null;
  orgUsername: string | null;
  memberSince: string | null;
  childCount: number;
  childNames: string[];
}

export async function getAccount(session: Session): Promise<AccountProfile> {
  const [user, children, org] = await Promise.all([
    getCurrentUser(),
    getApiChildren(),
    session.orgId
      ? apiRequest<ApiOrganisation>(`/organisations/${session.orgId}`)
      : Promise.resolve(null),
  ]);
  return {
    userId: user.id,
    name: session.name,
    guardianName: session.guardianName ?? null,
    email: user.email,
    avatarUrl: apiAssetUrl(user.avatar_url) ?? null,
    avatarSticker: (user.avatar_sticker as AvatarSticker | null) ?? null,
    role: session.role,
    accountType: session.accountType,
    tier: session.tier,
    orgName: org?.name ?? null,
    orgKind: org?.kind ?? null,
    orgUsername: null,
    memberSince: user.created_at.slice(0, 10),
    childCount: children.length,
    childNames: children.map((child) => child.name),
  };
}

export async function uploadProfilePhoto(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<ApiUser>("/auth/me/avatar", { method: "POST", body: form });
}

export async function chooseProfileSticker(sticker: AvatarSticker) {
  return apiRequest<ApiUser>("/auth/me/avatar", {
    method: "PUT",
    body: JSON.stringify({ sticker }),
  });
}

export async function removeProfileAvatar() {
  return apiRequest<void>("/auth/me/avatar", { method: "DELETE" });
}

export async function changePassword(input: { current: string; next: string }) {
  try {
    await apiRequest<{ detail: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: input.current, new_password: input.next }),
    });
    return {
      ok: true as const,
      message: "Password updated. Use the new one next time you sign in.",
    };
  } catch (reason) {
    return {
      ok: false as const,
      message: reason instanceof Error ? reason.message : "Could not update your password.",
    };
  }
}

/** Asks for a reset link. The API answers the same way whether or not the email has an account. */
export async function requestPasswordReset(email: string) {
  const res = await apiRequest<{ detail: string }>("/auth/password/forgot", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ email: email.trim() }),
  });
  return res.detail;
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await apiRequest<{ detail: string }>("/auth/password/reset", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  return res.detail;
}
