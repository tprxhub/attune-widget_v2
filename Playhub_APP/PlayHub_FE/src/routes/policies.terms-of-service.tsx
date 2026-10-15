import { createFileRoute } from "@tanstack/react-router";
import { SavedPolicyPage } from "@/features/policies/SavedPolicyPage";

export const Route = createFileRoute("/policies/terms-of-service")({
  head: () => ({
    meta: [
      { title: "Terms of service — Play Hub" },
      {
        name: "description",
        content: "The terms of service for Play Hub, operated by The Toy Pharmacy - FZCO.",
      },
    ],
  }),
  component: () => <SavedPolicyPage policy="terms" />,
});
