import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { apiRequest, setAccessToken, type ApiToken } from "@/api/client";
import { useSession } from "@/auth/session";
import { AuthLayout, authButton, authInput, authLabel } from "@/components/AuthLayout";
import loginArt from "@/assets/login-art.jpg";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({ meta: [{ title: "Accept invitation — Play Hub" }] }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useSearch();
  const { refreshSession } = useSession();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return setError("This invitation link is incomplete.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("The passwords do not match.");
    setPending(true);
    setError("");
    try {
      const response = await apiRequest<ApiToken>("/invitations/accept", {
        method: "POST",
        authenticated: false,
        body: JSON.stringify({
          token,
          display_name: displayName.trim() || null,
          password,
        }),
      });
      setAccessToken(response.access_token);
      const session = await refreshSession();
      await navigate({ to: session.homePath });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to accept this invitation.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout artImage={loginArt}>
      <h1 className="text-4xl leading-tight font-bold text-navy">Accept your invitation</h1>
      <p className="mt-2 text-sm text-navy/65">
        Choose your password to activate your Play Hub account.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="invite-name" className={authLabel}>
            Display name
          </label>
          <input
            id="invite-name"
            disabled={!mounted || pending}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            className={authInput}
          />
        </div>
        <div>
          <label htmlFor="invite-password" className={authLabel}>
            Password
          </label>
          <input
            id="invite-password"
            disabled={!mounted || pending}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className={authInput}
          />
        </div>
        <div>
          <label htmlFor="invite-confirm" className={authLabel}>
            Confirm password
          </label>
          <input
            id="invite-confirm"
            disabled={!mounted || pending}
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            className={authInput}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
          >
            {error}
          </p>
        )}
        <button type="submit" disabled={pending || !mounted} className={authButton}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          Activate account
        </button>
      </form>
      <p className="mt-6 text-sm text-navy/65">
        Already activated?{" "}
        <Link to="/login" className="font-bold underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
