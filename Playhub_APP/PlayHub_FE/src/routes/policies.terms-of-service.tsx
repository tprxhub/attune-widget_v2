import { createFileRoute } from "@tanstack/react-router";
import { PolicyLayout } from "@/features/policies/PolicyLayout";
import { TERMS_INTRO, TERMS_SECTIONS } from "@/features/policies/terms";

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
  component: () => (
    <PolicyLayout title="Terms of service" intro={TERMS_INTRO} sections={TERMS_SECTIONS} />
  ),
});
