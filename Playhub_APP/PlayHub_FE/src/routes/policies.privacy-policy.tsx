import { createFileRoute } from "@tanstack/react-router";
import { SavedPolicyPage } from "@/features/policies/SavedPolicyPage";

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
  component: () => <SavedPolicyPage policy="privacy" />,
});
