import { createFileRoute, redirect } from "@tanstack/react-router";

/** The Members page moved to /admin/members; old links and bookmarks still land there. */
export const Route = createFileRoute("/admin/children")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/members", replace: true });
  },
});
