import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Eye, EyeOff, HeartHandshake, Loader2 } from "lucide-react";
import loginArt from "@/assets/login-art.jpg";
import { useSession } from "@/auth/session";
import { AuthLayout, authButton, authInput, authLabel } from "@/components/AuthLayout";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Play Hub" },
      {
        name: "description",
        content:
          "Log in to Play Hub as a family or with organisation credentials issued by The Toy Pharmacy.",
      },
      { property: "og:title", content: "Log in — Play Hub" },
      {
        property: "og:description",
        content: "Log in to Play Hub as a family or with issued organisation credentials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [tab, setTab] = useState<"b2c" | "b2b">("b2c");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { signIn, signInWithGoogle, hydrated } = useSession();
  const navigate = useNavigate();
  const isReady = mounted && hydrated;
  const googleEnabled = Boolean(import.meta.env["VITE_GOOGLE_CLIENT_ID"]);

  useEffect(() => setMounted(true), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError("Enter your email address.");
    if (password.length < 8) return setError("Enter your password (at least 8 characters).");
    setPending(true);
    try {
      const session = await signIn(email.trim(), password);
      await navigate({ to: session.homePath });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  };

  const submitGoogle = async (credential: string) => {
    setPending(true);
    setError(null);
    try {
      const session = await signInWithGoogle(credential);
      await navigate({ to: session.homePath });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in with Google.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout artImage={loginArt}>
      <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-navy sm:text-5xl">
        Welcome Back
      </h1>
      <p className="mt-3 inline-flex items-center gap-2 text-sm text-navy/70">
        New to Play Hub?
        <Link to="/signup" className="font-bold text-navy underline underline-offset-4">
          Create an account
        </Link>
      </p>

      <div
        className="mt-7 grid grid-cols-2 gap-2 rounded-full bg-navy/6 p-1"
        role="tablist"
        aria-label="Account type"
      >
        {(
          [
            ["b2c", "Family", HeartHandshake],
            ["b2b", "School / clinic", Building2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            role="tab"
            disabled={!isReady || pending}
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              setError(null);
            }}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-bold transition-colors",
              tab === key ? "bg-card text-navy shadow-[var(--shadow-card)]" : "text-navy/60",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="email" className={authLabel}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
            disabled={!isReady || pending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder={tab === "b2c" ? "you@example.com" : "you@school.org"}
            className={authInput}
          />
        </div>
        <div>
          <label htmlFor="password" className={authLabel}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              disabled={!isReady || pending}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Password"
              className={cn(authInput, "pr-14")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-navy/50 hover:text-navy"
            >
              {showPassword ? (
                <Eye className="h-5 w-5" aria-hidden />
              ) : (
                <EyeOff className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={pending || !isReady} className={cn(authButton, "mt-2")}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          Log in
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-6 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-navy/10" />
            <span className="text-xs font-bold text-navy/40 uppercase">or</span>
            <span className="h-px flex-1 bg-navy/10" />
          </div>
          <GoogleSignInButton onCredential={submitGoogle} disabled={!isReady || pending} />
        </>
      )}

      {tab === "b2b" && (
        <p className="mt-6 rounded-2xl bg-navy/5 p-4 text-sm text-navy/70">
          Organisation accounts are invitation-only. Use the email address and password you set when
          accepting your invitation.
        </p>
      )}
    </AuthLayout>
  );
}
