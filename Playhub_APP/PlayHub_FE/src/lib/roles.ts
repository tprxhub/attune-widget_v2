import type { PermissionKey, Session } from "./types";

/** Super Admins and TTP employees work across the whole platform. */
export const isPlatformRole = (role: string) => role === "super_admin" || role === "ttp_employee";

/** A Super Admin may use every page; a TTP employee only the pages ticked for them. */
export function hasPermission(session: Session, key: PermissionKey): boolean {
  if (session.role === "super_admin") return true;
  return session.role === "ttp_employee" && (session.permissions ?? []).includes(key);
}

/** Audit log entry types a TTP employee can be allowed to read; each has its own tick. */
export const AUDIT_PERMISSION_OPTIONS: {
  key: PermissionKey;
  category: "activity" | "accounts" | "content" | "billing" | "organisations" | "system";
  label: string;
  hint: string;
  sensitive?: boolean;
}[] = [
  {
    key: "audit_activity",
    category: "activity",
    label: "Check-ins",
    hint: "Sessions logged for children",
  },
  {
    key: "audit_accounts",
    category: "accounts",
    label: "Accounts",
    hint: "Sign-ups, invitations and user changes",
    sensitive: true,
  },
  {
    key: "audit_content",
    category: "content",
    label: "Play content",
    hint: "Play Plans, Doses, Activities and home page edits",
  },
  {
    key: "audit_billing",
    category: "billing",
    label: "Billing & payments",
    hint: "Checkouts, payments, refunds and subscriptions",
    sensitive: true,
  },
  {
    key: "audit_organisations",
    category: "organisations",
    label: "Organisations & children",
    hint: "Schools, clinics and enrolled children",
  },
  {
    key: "audit_system",
    category: "system",
    label: "System",
    hint: "Everything else, such as developer events",
  },
];

/** The audit log categories this person may read (all of them for a Super Admin). */
export function allowedAuditCategories(session: Session): string[] {
  return AUDIT_PERMISSION_OPTIONS.filter((option) => hasPermission(session, option.key)).map(
    (option) => option.category,
  );
}

export const PERMISSION_OPTIONS: {
  key: PermissionKey;
  label: string;
  hint: string;
  sensitive?: boolean;
}[] = [
  { key: "children", label: "Children", hint: "View, enrol and edit children and their plans" },
  { key: "progress", label: "Progress", hint: "Platform-wide progress and CSV export" },
  {
    key: "billing",
    label: "Subscriptions & billing",
    hint: "See family subscriptions and revenue, and grant or cancel a subscription by hand",
    sensitive: true,
  },
  {
    key: "audit",
    label: "Audit log",
    hint: "Open the audit log and export it to Excel. Choose which log types below.",
  },
  {
    key: "plans",
    label: "Plans library",
    hint: "Create and edit Play Plans, Play Doses and Activities",
  },
  { key: "homepage", label: "Home page", hint: "Edit the public home page wording" },
  { key: "organisations", label: "Organisations", hint: "Create and suspend schools and clinics" },
  {
    key: "team",
    label: "Admins & Moderators",
    hint: "Invite and manage organisation Admins and Moderators",
  },
];

export function roleLabel(role: string, accountType?: Session["accountType"]): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "ttp_employee":
      return "TTP Employee";
    case "educator":
      return "Admin";
    case "supporter":
      return "Moderator";
    case "parent":
      return accountType === "b2c" ? "Admin" : "Member";
    default:
      return "Visitor";
  }
}

export function accountLabel(session: Session): string {
  if (session.accountType === "platform") return "Play Hub platform";
  if (session.accountType === "b2b") return "Organisation account";
  if (session.accountType === "b2c")
    return session.tier === "subscribed" ? "Family account · Subscribed" : "Family account · Free";
  return "Not signed in";
}
