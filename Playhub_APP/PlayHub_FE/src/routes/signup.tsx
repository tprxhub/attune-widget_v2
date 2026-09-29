import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import loginArt from "@/assets/login-art.jpg";
import { useSession } from "@/auth/session";
import { AuthLayout, authButton, authInput, authLabel } from "@/components/AuthLayout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create a free family account — Play Hub" },
      {
        name: "description",
        content:
          "Sign up free to browse every Play Plan and try the first Play Dose for your child.",
      },
      { property: "og:title", content: "Create a free family account — Play Hub" },
      {
        property: "og:description",
        content: "Browse every Play Plan and try the first Play Dose free.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { registerFamily } = useSession();
  const navigate = useNavigate();

  useEffect(() => setMounted(true), []);

  const finish = async () => {
    setPending(true);
    const guardian = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    try {
      const session = await registerFamily({
        childName: childName.trim(),
        childAge: Number(childAge),
        guardianName: guardian,
        email: email.trim(),
        password,
      });
      await navigate({ to: session.homePath });
    } catch (reason) {
      setErrors({ form: reason instanceof Error ? reason.message : "Unable to create account." });
    } finally {
      setPending(false);
    }
  };

  const submit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (childName.trim().length < 2) next["childName"] = "Tell us your child's first name.";
    const age = Number(childAge);
    if (!childAge || Number.isNaN(age) || age < 1 || age > 12)
      next["childAge"] = "Enter an age between 1 and 12.";
    if (firstName.trim().length < 2) next["firstName"] = "Tell us your first name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next["email"] = "Enter a valid email address.";
    if (password.length < 8) next["password"] = "Use at least 8 characters.";
    if (!agreed) next["agreed"] = "Please accept the Terms & Conditions.";
    setErrors(next);
    if (Object.keys(next).length) return;
    await finish();
  };

  return (
    <AuthLayout artImage={loginArt}>
      <h1 className="text-3xl leading-[1.05] font-bold tracking-tight text-navy sm:text-4xl">
        Create an Account
      </h1>
      <p className="mt-2 text-sm text-navy/70">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-navy underline underline-offset-4">
          Log in
        </Link>
      </p>

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <div className="rounded-2xl bg-navy/5 p-4">
          <p className="text-[11px] font-bold tracking-[0.14em] text-navy/60 uppercase">
            Who is this account for?
          </p>
          <p className="mt-1 text-xs text-navy/65">
            Play Hub accounts sit in the child's name and are run by you, the parent or carer, with
            your own email. One child per family account.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1.6fr_1fr]">
            <div>
              <label htmlFor="childName" className={authLabel}>
                Child's First Name
              </label>
              <input
                id="childName"
                disabled={!mounted || pending}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Amira"
                aria-invalid={Boolean(errors["childName"])}
                className={authInput}
              />
              {errors["childName"] && (
                <p className="mt-1 text-xs font-semibold text-coral">{errors["childName"]}</p>
              )}
            </div>
            <div>
              <label htmlFor="childAge" className={authLabel}>
                Child's Age
              </label>
              <input
                id="childAge"
                disabled={!mounted || pending}
                type="number"
                min={1}
                max={12}
                value={childAge}
                onChange={(e) => setChildAge(e.target.value)}
                placeholder="5"
                aria-invalid={Boolean(errors["childAge"])}
                className={authInput}
              />
              {errors["childAge"] && (
                <p className="mt-1 text-xs font-semibold text-coral">{errors["childAge"]}</p>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] font-bold tracking-[0.14em] text-navy/60 uppercase">
          Your details
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={authLabel}>
              First Name
            </label>
            <input
              id="firstName"
              disabled={!mounted || pending}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              aria-invalid={Boolean(errors["firstName"])}
              className={authInput}
            />
            {errors["firstName"] && (
              <p className="mt-1 text-xs font-semibold text-coral">{errors["firstName"]}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className={authLabel}>
              Last Name
            </label>
            <input
              id="lastName"
              disabled={!mounted || pending}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className={authInput}
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className={authLabel}>
            Email Address
          </label>
          <input
            id="email"
            disabled={!mounted || pending}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. you@example.com"
            autoComplete="email"
            aria-invalid={Boolean(errors["email"])}
            className={authInput}
          />
          <p className="mt-1.5 text-xs text-navy/55">
            Use any email address you check — this is what you'll sign in with.
          </p>
          {errors["email"] && (
            <p className="mt-1 text-xs font-semibold text-coral">{errors["email"]}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className={authLabel}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              disabled={!mounted || pending}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors["password"])}
              className={cn(authInput, "pr-14")}
            />
            <button
              type="button"
              disabled={!mounted || pending}
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
          {errors["password"] && (
            <p className="mt-1 text-xs font-semibold text-coral">{errors["password"]}</p>
          )}
        </div>

        <button type="submit" disabled={pending || !mounted} className={cn(authButton, "mt-2")}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          Create Account
        </button>

        {errors["form"] && (
          <p
            role="alert"
            className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
          >
            {errors["form"]}
          </p>
        )}

        <div>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-navy">
            <input
              type="checkbox"
              disabled={!mounted || pending}
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                agreed ? "border-navy bg-navy text-white" : "border-navy/30",
              )}
            >
              {agreed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span>
              I agree to the{" "}
              <span className="font-bold underline underline-offset-4">Terms &amp; Condition</span>
            </span>
          </label>
          {errors["agreed"] && (
            <p className="mt-1 text-xs font-semibold text-coral">{errors["agreed"]}</p>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
