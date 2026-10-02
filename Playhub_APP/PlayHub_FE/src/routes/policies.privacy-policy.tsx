import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/features/policies/PolicyLayout";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/features/policies/privacy";

export const Route = createFileRoute("/policies/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Play Hub" },
      {
        name: "description",
        content:
          "How Play Hub, operated by The Toy Pharmacy - FZCO, collects and uses information.",
      },
    ],
  }),
  component: () => (
    <PolicyLayout title="Privacy policy" intro={PRIVACY_INTRO} sections={PRIVACY_SECTIONS} />
  ),
});
