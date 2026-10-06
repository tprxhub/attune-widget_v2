import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset } from "@/api/account";
import { AuthLayout, authButton, authInput, authLabel } from "@/components/AuthLayout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search["email"] === "string" ? search["email"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Forgot password — Play Hub" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email address you sign in with.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/70 hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to log in
      </Link>
      <h1 className="mt-6 text-4xl leading-[1.05] font-bold tracking-tight text-navy">
        Forgot your password?
      </h1>
      {sent ? (
        <div role="status" className="mt-6 rounded-2xl bg-blue/8 p-5 text-navy">
          <MailCheck className="h-6 w-6 text-blue" aria-hidden />
          <p className="mt-2 font-bold">Check your email</p>
          <p className="mt-1 text-sm text-navy/75">
            If an account uses <b>{email.trim()}</b>, we’ve sent a link to reset its password. The
            link works once, for one hour. Don’t see it? Check your spam folder.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-3 text-sm font-bold text-blue underline underline-offset-4"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-navy/70">
            Enter the email you sign in with and we’ll send you a link to choose a new password.
          </p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-5">
            <div>
              <label htmlFor="forgot-email" className={authLabel}>
                Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
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
            <button type="submit" disabled={pending} className={cn(authButton, "mt-2")}>
              {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              Send reset link
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
