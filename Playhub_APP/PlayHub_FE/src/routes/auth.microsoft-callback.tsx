import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Where Microsoft sends the sign-in popup back to. It hands the result to the page that opened
 * the popup, which then closes it. This URL must be listed as a "Single-page application"
 * redirect URI in the Azure app registration.
 */
export const Route = createFileRoute("/auth/microsoft-callback")({
  head: () => ({
    meta: [{ title: "Signing in — Play Hub" }, { name: "robots", content: "noindex" }],
  }),
  component: MicrosoftCallback,
});

function MicrosoftCallback() {
  useEffect(() => {
    void import("@azure/msal-browser/redirect-bridge")
      .then(({ broadcastResponseToMainFrame }) => broadcastResponseToMainFrame())
      .catch(() => undefined);
  }, []);
  return (
    <p className="grid min-h-screen place-items-center text-sm font-semibold text-navy/60">
      Signing you in…
    </p>
  );
}
