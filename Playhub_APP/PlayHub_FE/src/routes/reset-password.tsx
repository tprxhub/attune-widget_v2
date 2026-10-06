import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { resetPassword } from "@/api/account";
import { AuthLayout, authButton, authInput, authLabel } from "@/components/AuthLayout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({ meta: [{ title: "Choose a new password — Play Hub" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don’t match.");
    setPending(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-navy">
        Choose a new password
      </h1>
      {!token ? (
        <div role="alert" className="mt-6 rounded-2xl bg-coral/10 p-5 text-sm text-coral">
          <p className="font-bold">This link is incomplete.</p>
          <p className="mt-1">Open the link from your email again, or ask for a new one.</p>
          <Link
            to="/forgot-password"
            search={{ email: undefined }}
            className="mt-3 inline-block font-bold underline underline-offset-4"
          >
            Send a new reset link
          </Link>
        </div>
      ) : done ? (
        <div role="status" className="mt-6 rounded-2xl bg-blue/8 p-5 text-navy">
          <CheckCircle2 className="h-6 w-6 text-blue" aria-hidden />
          <p className="mt-2 font-bold">Password updated</p>
          <p className="mt-1 text-sm text-navy/75">You can log in with your new password now.</p>
          <Link to="/login" className={cn(authButton, "mt-4")}>
            Log in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          <div>
            <label htmlFor="new-password" className={authLabel}>
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={cn(authInput, "pr-14")}
              />
              <button
                type="button"
                onClick={() => setShow((value) => !value)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-navy/50 hover:text-navy"
              >
                {show ? (
                  <Eye className="h-5 w-5" aria-hidden />
                ) : (
                  <EyeOff className="h-5 w-5" aria-hidden />
                )}
              </button>
            </div>
            <p className="mt-1.5 pl-5 text-xs text-navy/55">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className={authLabel}>
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className={authInput}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
            >
              {error}{" "}
              {/expired|already used/i.test(error) && (
                <Link
                  to="/forgot-password"
                  search={{ email: undefined }}
                  className="underline underline-offset-4"
                >
                  Send a new link
                </Link>
              )}
            </p>
          )}
          <button type="submit" disabled={pending} className={cn(authButton, "mt-2")}>
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            Save new password
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
