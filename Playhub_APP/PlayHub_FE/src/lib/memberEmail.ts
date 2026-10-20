import type { Child } from "./types";

/** The email shown for a member: their linked account's, or one invited but not yet accepted. */
export function memberEmailLabel(child: Pick<Child, "parentEmail" | "invitedEmail">) {
  if (child.parentEmail) return child.parentEmail;
  if (child.invitedEmail) return child.invitedEmail;
  return "No email linked yet";
}
