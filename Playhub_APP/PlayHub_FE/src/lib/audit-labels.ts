/** Plain-English names for audit log actions, shared by the Audit log and the Overview. */
export const ACTION_TITLES: Record<string, string> = {
  "activity.created": "Activity created",
  "activity.deleted": "Activity deleted",
  "activity.updated": "Activity updated",
  "activity.video_uploaded": "Activity video uploaded",
  "attempt.created": "Attempt recorded",
  "attempt.corrected": "Session corrected",
  "billing.checkout_created": "Checkout started",
  "billing.payment_completed": "Payment completed",
  "billing.refund_completed": "Refund completed",
  "billing.refund_failed": "Refund failed",
  "billing.refunded": "Refund requested",
  "billing.renewal_refunded": "Renewal refunded",
  "child.created": "Child profile created",
  "child.updated": "Child profile updated",
  "developer.persona_switched": "Test persona switched",
  "family.registered": "Family account registered",
  "invitation.accepted": "Invitation accepted",
  "invitation.activation_regenerated": "Activation link regenerated",
  "invitation.created": "Invitation sent",
  "organisation.created": "Organisation created",
  "organisation.updated": "Organisation updated",
  "play_dose.created": "Play Dose created",
  "play_dose.deleted": "Play Dose deleted",
  "play_dose.thumbnail_uploaded": "Play Dose image uploaded",
  "play_dose.updated": "Play Dose updated",
  "play_plan.created": "Play Plan created",
  "play_plan.updated": "Play Plan updated",
  "site_content.reset": "Homepage content reset",
  "site_content.updated": "Homepage content updated",
  "subscription.manually_updated": "Subscription updated",
  "user.avatar_removed": "Profile photo removed",
  "user.avatar_sticker_selected": "Profile character selected",
  "user.avatar_uploaded": "Profile photo uploaded",
  "user.google_linked": "Google account connected",
  "user.apple_linked": "Apple account connected",
  "user.microsoft_linked": "Microsoft account connected",
  "user.password_reset_requested": "Password reset requested",
  "user.password_reset": "Password reset",
  "user.password_changed": "Password changed",
  "user.updated": "Account updated",
};

/** "Play Dose updated"; unknown actions fall back to a readable version of their code. */
export function actionTitle(action: string): string {
  return (
    ACTION_TITLES[action] ??
    action
      .split(".")
      .map((part) => part.replace(/_/g, " "))
      .join(" · ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}
