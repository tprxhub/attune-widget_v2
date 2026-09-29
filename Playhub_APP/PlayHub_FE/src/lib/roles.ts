import type { Session } from "./types";

export function roleLabel(role: string, accountType?: Session["accountType"]): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
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
