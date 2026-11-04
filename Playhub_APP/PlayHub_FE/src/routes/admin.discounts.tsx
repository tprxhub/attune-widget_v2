import { createFileRoute, redirect } from "@tanstack/react-router";

/** Discounts now live on the Subscription page, next to the plans they apply to. */
export const Route = createFileRoute("/admin/discounts")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/subscription", search: { tab: "discounts" } });
  },
});
