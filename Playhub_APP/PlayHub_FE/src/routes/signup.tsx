import { ApiError, apiAssetUrl, sendSignupCode, verifySignupCode } from "@/api/client";
import { loadHomepageForRoute, useHomepageContent } from "@/features/homepage/useHomepageContent";
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CircleCheck,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MailCheck,
} from "lucide-react";
import loginArt from "@/assets/login-art.jpg";
import { useSession } from "@/auth/session";
import { AuthLayout, authButton, authInput, authLabel } from "@/components/AuthLayout";
import {
  SocialSignInButtons,
  socialSignInEnabled,
  type SocialCredential,
} from "@/components/SocialSignInButtons";
import { PolicyModal } from "@/features/policies/PolicyModal";
import { displayPricePlan, loadPricingForRoute, usePricePlans } from "@/api/pricing";
import {
  checkout,
  getSignupPayment,
  PLAN_FEATURES,
  startSignupCheckout,
} from "@/api/subscriptions";
import type { PlanDuration } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SignupSearch {
  /** Chosen on the pricing section: pay first, then set up the account. */
  plan?: string | undefined;
  /** Stripe sends the visitor back here with this after paying. */
  session_id?: string | undefined;
  checkout?: "cancelled" | undefined;
}

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): SignupSearch => ({
    plan:
      typeof search["plan"] === "string" && /^\d{1,2}m$/.test(search["plan"])
        ? search["plan"]
        : undefined,
    session_id:
      typeof search["session_id"] === "string" && search["session_id"].length < 300
        ? search["session_id"]
        : undefined,
    checkout: search["checkout"] === "cancelled" ? "cancelled" : undefined,
  }),
  loader: async ({ context }) => {
    const [homepage, pricing] = await Promise.all([
      loadHomepageForRoute(context.queryClient),
      loadPricingForRoute(context.queryClient),
    ]);
    return { ...homepage, ...pricing };
  },
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

/**
 * Signup one small step at a time: email first, then the emailed code, then a password, then the
 * child, then a plan. The account is created once the child's details are in (before any payment),
 * so leaving at the plan step still leaves a working free account.
 *
 * Starting from a plan on the pricing section ("pay first"): email, code, payment, then the
 * password and the child. The account created at the end takes over the paid plan.
 */
type Step = "email" | "verify" | "pay" | "confirming" | "account" | "child" | "plan";

/** What survives the trip to Stripe and back (this tab only). */
const PAY_FIRST_KEY = "playhub.signup.payFirst";
interface PayFirstState {
  email: string;
  emailToken: string;
  plan: string;
}
function readPayFirst(): PayFirstState | null {
  try {
    const raw = sessionStorage.getItem(PAY_FIRST_KEY);
    return raw ? (JSON.parse(raw) as PayFirstState) : null;
  } catch {
    return null;
  }
}
function savePayFirst(state: PayFirstState | null) {
  try {
    if (state) sessionStorage.setItem(PAY_FIRST_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(PAY_FIRST_KEY);
  } catch {
    // Private mode: the flow still works, only a cancelled payment starts again from the email.
  }
}

/** Seconds before another code can be sent. */
const RESEND_AFTER = 30;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FREE = "free";

function SignupPage() {
  const { auth } = useHomepageContent();
  const { session, hydrated, registerFamily, registerWithProvider, signInWithProvider } =
    useSession();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [step, setStep] = useState<Step>(search.session_id ? "confirming" : "email");
  const [payFirst, setPayFirst] = useState(
    Boolean(search.plan || search.session_id || search.checkout),
  );
  const [chosenPlan, setChosenPlan] = useState<string | undefined>(search.plan);
  // Set once Stripe confirms the payment: shown above the remaining steps.
  const [paidLabel, setPaidLabel] = useState<string | null>(null);
  // Set once this page creates the account, so being signed in doesn't bounce away mid-flow.
  const createdHere = useRef(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [social, setSocial] = useState<SocialCredential | null>(null);
  const [code, setCode] = useState("");
  const [emailToken, setEmailToken] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // Only from a development server with no email set up: its code, shown instead of emailed.
  const [devCode, setDevCode] = useState<string | null>(null);
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Counts down to when another code may be sent.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Back from Stripe: wait for the payment to be confirmed, then carry on with the details.
  useEffect(() => {
    const sessionId = search.session_id;
    if (!sessionId) return;
    let stopped = false;
    let tries = 0;
    const check = async () => {
      try {
        const payment = await getSignupPayment(sessionId);
        if (stopped) return;
        setEmail(payment.email);
        if (payment.status === "paid" && payment.email_token) {
          setEmailToken(payment.email_token);
          setPaidLabel(payment.plan_label ?? payment.plan);
          setErrors({});
          setStep("account");
          return;
        }
        if (payment.status === "claimed") {
          setErrors({ form: "This payment is already linked to a Play Hub account.", taken: "1" });
          return;
        }
        tries += 1;
        if (tries >= 30) {
          setErrors({
            form: "Stripe is still confirming your payment. It's safe: verify your email again and the plan is added to your account as soon as it's confirmed.",
            slow: "1",
          });
          return;
        }
        setTimeout(() => void check(), 2000);
      } catch (reason) {
        if (!stopped) {
          setErrors({
            form: reason instanceof Error ? reason.message : "We couldn't find that payment.",
          });
        }
      }
    };
    void check();
    return () => {
      stopped = true;
    };
  }, [search.session_id]);

  // A cancelled payment comes back to the payment step, with the verified email kept.
  useEffect(() => {
    if (search.checkout !== "cancelled") return;
    const saved = readPayFirst();
    if (saved) {
      setEmail(saved.email);
      setEmailToken(saved.emailToken);
      setChosenPlan(saved.plan);
      setNotice("Payment cancelled. Nothing was charged; you can try again.");
      setStep("pay");
    }
  }, [search.checkout]);

  // Each step moves focus to its heading, so keyboard and screen-reader users start at the top.
  useEffect(() => {
    if (mounted) heading.current?.focus();
  }, [step, mounted]);

  // Someone already signed in skips signup, unless this page just created their account.
  if (hydrated && session.role !== "anonymous" && !createdHere.current) {
    return <Navigate to="/hub" replace />;
  }

  const go = (next: Step) => {
    setErrors({});
    setStep(next);
  };
  const busy = !mounted || pending;

  /** Emails a code; an address that already has an account is pointed to log in instead. */
  const sendCode = async (): Promise<boolean> => {
    setPending(true);
    setNotice(null);
    try {
      const sent = await sendSignupCode(email.trim());
      setDevCode(sent.dev_code ?? null);
      setResendIn(RESEND_AFTER);
      return true;
    } catch (reason) {
      const taken = reason instanceof ApiError && reason.status === 409;
      setErrors({
        form: taken
          ? "This email already has a Play Hub account."
          : reason instanceof Error
            ? reason.message
            : "We couldn't send the code. Please try again.",
        ...(taken && { taken: "1" }),
      });
      return false;
    } finally {
      setPending(false);
    }
  };

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) return setErrors({ email: "Enter a valid email address." });
    setErrors({});
    setSocial(null);
    setEmailToken("");
    setCode("");
    if (await sendCode()) go("verify");
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code from the email." });
    setPending(true);
    setErrors({});
    try {
      const token = await verifySignupCode(email.trim(), code);
      setEmailToken(token);
      go(payFirst && !paidLabel ? "pay" : "account");
    } catch (reason) {
      setErrors({ code: reason instanceof Error ? reason.message : "That code didn't work." });
      setCode("");
    } finally {
      setPending(false);
    }
  };

  const resendCode = async () => {
    setErrors({});
    setCode("");
    if (await sendCode()) setNotice("A new code is on its way. Only the newest code works.");
  };

  const submitAccount = (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (firstName.trim().length < 2) next["firstName"] = "Tell us your first name.";
    if (password.length < 8) next["password"] = "Use at least 8 characters.";
    if (!agreed) next["agreed"] = "Please accept the Terms & Conditions.";
    setErrors(next);
    if (Object.keys(next).length === 0) go("child");
  };

  /** Google (or Apple/Microsoft): an existing account just signs in; a new one goes to the child. */
  const submitSocial = async (credential: SocialCredential) => {
    setPending(true);
    setErrors({});
    try {
      await signInWithProvider(credential.provider, credential.credential, credential.name);
      await navigate({ to: "/hub" });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) {
        setSocial(credential);
        go("child");
      } else if (reason instanceof ApiError && reason.status === 409) {
        setErrors({
          form: "This email already has a Play Hub account. Log in with your password to link it.",
        });
      } else {
        setErrors({ form: reason instanceof Error ? reason.message : "Unable to continue." });
      }
    } finally {
      setPending(false);
    }
  };

  const submitChild = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (childName.trim().length < 2) next["childName"] = "Tell us your child's first name.";
    if (!childAge) next["childAge"] = "Choose your child's age.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !childAge) return;
    setPending(true);
    createdHere.current = true;
    try {
      if (social) {
        await registerWithProvider({ ...social, childName: childName.trim(), childAge });
      } else {
        await registerFamily({
          childName: childName.trim(),
          childAge,
          guardianName: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
          email: email.trim(),
          password,
          emailToken,
        });
      }
      savePayFirst(null);
      if (paidLabel) {
        // Paid first: the plan is already on the account.
        await navigate({ to: "/hub" });
        return;
      }
      go("plan");
    } catch (reason) {
      createdHere.current = false;
      const message = reason instanceof Error ? reason.message : "Unable to create account.";
      setErrors({
        form: message,
        ...(/already|exists|registered/i.test(message) && { taken: "1" }),
      });
    } finally {
      setPending(false);
    }
  };

  const stepNumber = payFirst
    ? { email: 0, verify: 1, pay: 2, confirming: 3, account: 3, child: 4, plan: 4 }[step]
    : { email: 0, verify: 1, pay: 2, confirming: 2, account: 2, child: 3, plan: 4 }[step];
  const stepLabel = `Step ${stepNumber} of 4`;
  const back = {
    email: null,
    verify: "email",
    pay: null,
    confirming: null,
    account: null,
    child: social ? "email" : "account",
    plan: null,
  }[step] as Step | null;

  const startPayment = async (plan: string) => {
    setPending(true);
    setErrors({});
    setNotice(null);
    try {
      const url = await startSignupCheckout(emailToken, plan as PlanDuration);
      savePayFirst({ email: email.trim(), emailToken, plan });
      window.location.assign(url);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403) {
        setErrors({ form: "Your email check has expired. Please verify your email again." });
        setStep("email");
      } else if (reason instanceof ApiError && reason.status === 409) {
        setErrors({ form: "This email already has a Play Hub account.", taken: "1" });
      } else {
        setErrors({ form: reason instanceof Error ? reason.message : "Unable to open payment." });
      }
      setPending(false);
    }
  };

  return (
    <AuthLayout artImage={apiAssetUrl(auth.signup_image_url) || loginArt}>
      {stepNumber > 0 && (
        <div className="mb-6 flex items-center justify-between gap-4">
          {back ? (
            <button
              type="button"
              onClick={() => go(back)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/70 hover:text-navy"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </button>
          ) : (
            <span />
          )}
          <StepProgress current={stepNumber} />
        </div>
      )}

      {paidLabel && (step === "account" || step === "child") && (
        <p
          role="status"
          className="mb-6 flex items-start gap-3 rounded-2xl bg-blue/10 px-4 py-3 text-sm text-navy"
        >
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue" aria-hidden />
          <span>
            <strong>Payment received</strong> for the {paidLabel} plan. Now set up your account; the
            plan is added to it straight away.
          </span>
        </p>
      )}

      {step === "confirming" && (
        <div className="text-center">
          {!errors["form"] && (
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue" aria-hidden />
          )}
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-5 text-3xl font-bold tracking-tight text-navy outline-none"
          >
            {errors["form"] ? "Almost there" : "Confirming your payment…"}
          </h1>
          {!errors["form"] && (
            <p className="mt-3 text-[15px] text-navy/70">
              This takes a few seconds. Please keep this page open.
            </p>
          )}
          <FormError errors={errors} />
          {errors["slow"] && (
            <button
              type="button"
              onClick={() => {
                setPayFirst(true);
                setPaidLabel(null);
                go("email");
              }}
              className={cn(authButton, "mt-5")}
            >
              Verify my email
            </button>
          )}
        </div>
      )}

      {step === "pay" && (
        <PayStep
          headingRef={heading}
          stepLabel={stepLabel}
          email={email.trim()}
          initialPlan={chosenPlan}
          pending={pending}
          notice={notice}
          onPay={(plan) => void startPayment(plan)}
          onStartFree={() => {
            setPayFirst(false);
            savePayFirst(null);
            go("account");
          }}
        />
      )}
      {step === "pay" && <FormError errors={errors} />}

      {step === "email" && (
        <>
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-3xl leading-[1.05] font-bold tracking-tight text-navy outline-none sm:text-4xl"
          >
            Small doses of play, real skill change.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-navy/70">
            Ready to start? Enter your email to create a free family account. Browse every Play Plan
            and try a Play Dose free.
          </p>
          <form onSubmit={submitEmail} noValidate className="mt-6">
            <label htmlFor="email" className={authLabel}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              disabled={busy}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="e.g. you@example.com"
              aria-invalid={Boolean(errors["email"])}
              className={authInput}
            />
            <FieldError message={errors["email"]} />
            <button type="submit" disabled={busy} className={cn(authButton, "mt-4")}>
              Get started
            </button>
          </form>
          {socialSignInEnabled && (
            <>
              <div className="my-6 flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-navy/10" />
                <span className="text-xs font-bold text-navy/40 uppercase">or</span>
                <span className="h-px flex-1 bg-navy/10" />
              </div>
              <SocialSignInButtons
                onCredential={submitSocial}
                onError={(message) => setErrors({ form: message })}
                disabled={busy}
                signUp
              />
            </>
          )}
          <FormError errors={errors} />
          <p className="mt-6 text-sm text-navy/70">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-navy underline underline-offset-4">
              Log in
            </Link>
          </p>
        </>
      )}

      {step === "verify" && (
        <>
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber/30 text-navy">
            <MailCheck className="h-7 w-7" aria-hidden />
          </span>
          <StepHeading ref={heading} eyebrow={stepLabel} title="Check your email">
            We sent a 6-digit code to <strong className="text-navy">{email.trim()}</strong>. Enter
            it below to confirm it&apos;s you. It works for 10 minutes.
          </StepHeading>
          <form onSubmit={submitCode} noValidate className="mt-6">
            <label htmlFor="code" className={authLabel}>
              Verification code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={busy}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              aria-invalid={Boolean(errors["code"])}
              className={cn(authInput, "text-center text-2xl font-bold tracking-[0.5em]")}
            />
            <FieldError message={errors["code"]} />
            <button type="submit" disabled={busy} className={cn(authButton, "mt-4")}>
              {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              Verify email
            </button>
          </form>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-navy/65">
              Didn&apos;t get it? Check spam, or{" "}
              {resendIn > 0 ? (
                <span className="font-semibold text-navy/50">resend in {resendIn}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void resendCode()}
                  disabled={busy}
                  className="font-bold text-blue underline underline-offset-4"
                >
                  send a new code
                </button>
              )}
            </span>
            <button
              type="button"
              onClick={() => go("email")}
              disabled={busy}
              className="font-bold text-navy underline underline-offset-4"
            >
              Change email
            </button>
          </div>
          {devCode && (
            <p
              data-testid="dev-code"
              className="mt-4 rounded-2xl border border-amber bg-amber/15 px-4 py-3 text-sm text-navy"
            >
              Email isn&apos;t set up on this server, so the code wasn&apos;t sent. For testing,
              your code is <strong className="tracking-widest">{devCode}</strong>.
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 rounded-2xl bg-blue/10 px-4 py-3 text-sm text-navy">
              {notice}
            </p>
          )}
          <FormError errors={errors} />
        </>
      )}

      {step === "account" && (
        <>
          <StepHeading ref={heading} eyebrow={stepLabel} title="Create your account">
            Just a few details and you&apos;re in. You&apos;ll sign in with this email.
          </StepHeading>
          <form onSubmit={submitAccount} noValidate className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-navy/5 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.14em] text-navy/55 uppercase">
                  Email
                </p>
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-navy">
                  <span className="truncate">{email.trim()}</span>
                  <BadgeCheck className="h-4 w-4 shrink-0 text-blue" aria-label="Verified" />
                </p>
              </div>
              <button
                type="button"
                onClick={() => go("email")}
                className="shrink-0 text-sm font-bold text-blue hover:underline"
              >
                Change
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className={authLabel}>
                  First Name
                </label>
                <input
                  id="firstName"
                  autoComplete="given-name"
                  disabled={busy}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  aria-invalid={Boolean(errors["firstName"])}
                  className={authInput}
                />
                <FieldError message={errors["firstName"]} />
              </div>
              <div>
                <label htmlFor="lastName" className={authLabel}>
                  Last Name
                </label>
                <input
                  id="lastName"
                  autoComplete="family-name"
                  disabled={busy}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className={authInput}
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className={authLabel}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  disabled={busy}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(errors["password"])}
                  aria-describedby="password-hint"
                  className={cn(authInput, "pr-14")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
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
              <p id="password-hint" className="mt-1.5 text-xs text-navy/55">
                At least 8 characters.
              </p>
              <FieldError message={errors["password"]} />
            </div>
            <div>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-navy">
                <input
                  id="agreed"
                  type="checkbox"
                  disabled={busy}
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
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
                  <button
                    type="button"
                    onClick={(event) => {
                      // Inside the label: open the terms without ticking the box.
                      event.preventDefault();
                      setPolicyOpen(true);
                    }}
                    className="font-bold underline underline-offset-4 hover:text-blue"
                  >
                    Terms &amp; Condition
                  </button>
                </span>
              </label>
              <FieldError message={errors["agreed"]} />
            </div>
            <button type="submit" disabled={busy} className={cn(authButton, "mt-2")}>
              Next
            </button>
          </form>
        </>
      )}

      {step === "child" && (
        <>
          <StepHeading ref={heading} eyebrow={stepLabel} title="Who are we playing with?">
            Play Hub builds each week around one child. Tell us a little about them.
          </StepHeading>
          <form onSubmit={submitChild} noValidate className="mt-6 space-y-5">
            <div>
              <label htmlFor="childName" className={authLabel}>
                Child&apos;s First Name
              </label>
              <input
                id="childName"
                disabled={busy}
                value={childName}
                onChange={(event) => setChildName(event.target.value)}
                placeholder="e.g. Amira"
                aria-invalid={Boolean(errors["childName"])}
                className={authInput}
              />
              <FieldError message={errors["childName"]} />
            </div>
            <fieldset>
              <legend className={authLabel}>Child&apos;s Age</legend>
              <div className="mt-2 grid grid-cols-6 gap-2">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((age) => (
                  <button
                    key={age}
                    type="button"
                    disabled={busy}
                    aria-pressed={childAge === age}
                    onClick={() => setChildAge(age)}
                    className={cn(
                      "min-h-11 rounded-xl border text-sm font-bold transition-colors",
                      childAge === age
                        ? "border-navy bg-navy text-cream"
                        : "border-navy/15 bg-white text-navy hover:border-navy/40",
                    )}
                  >
                    {age}
                  </button>
                ))}
              </div>
              <FieldError message={errors["childAge"]} />
            </fieldset>
            <p className="rounded-2xl bg-navy/5 px-4 py-3 text-xs leading-relaxed text-navy/65">
              The account sits in your child&apos;s name and is run by you, the parent or carer. One
              child per family account.
            </p>
            <button type="submit" disabled={busy} className={authButton}>
              {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              Create account
            </button>
          </form>
          <FormError errors={errors} />
        </>
      )}

      {step === "plan" && (
        <PlanStep
          headingRef={heading}
          childName={childName.trim()}
          childId={session.childIds[0] ?? null}
        />
      )}

      {policyOpen && (
        <PolicyModal
          onClose={() => setPolicyOpen(false)}
          onAgree={() => {
            setAgreed(true);
            setErrors(({ agreed: _ignored, ...rest }) => rest);
          }}
        />
      )}
    </AuthLayout>
  );
}

/** Pay first (from the pricing section): confirm or change the paid plan, then go to Stripe. */
function PayStep({
  headingRef,
  stepLabel,
  email,
  initialPlan,
  pending,
  notice,
  onPay,
  onStartFree,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  stepLabel: string;
  email: string;
  initialPlan: string | undefined;
  pending: boolean;
  notice: string | null;
  onPay: (plan: string) => void;
  onStartFree: () => void;
}) {
  const pricing = usePricePlans();
  const plans = pricing.plans.map(displayPricePlan);
  const recommended = plans.find((plan) => plan.featured) ?? plans[0];
  const [choice, setChoice] = useState<string | undefined>(
    plans.some((plan) => plan.duration === initialPlan) ? initialPlan : recommended?.duration,
  );
  const chosen = plans.find((plan) => plan.duration === choice) ?? recommended;

  return (
    <>
      <StepHeading ref={headingRef} eyebrow={stepLabel} title="Confirm your plan">
        Your email <strong className="text-navy">{email}</strong> is verified. Pay now, then set up
        your account and your child&apos;s profile.
      </StepHeading>
      {notice && (
        <p role="status" className="mt-4 rounded-2xl bg-amber/20 px-4 py-3 text-sm text-navy">
          {notice}
        </p>
      )}
      <div role="radiogroup" aria-label="Plans" className="mt-6 grid gap-3">
        {plans.map((plan) => (
          <PlanOption
            key={plan.duration}
            selected={chosen?.duration === plan.duration}
            onSelect={() => setChoice(plan.duration)}
            title={plan.label}
            price={plan.price}
            detail={plan.per}
            badge={plan === recommended ? plan.badge_text || "Recommended" : undefined}
          />
        ))}
      </div>
      <ul className="mt-5 grid gap-2">
        {PLAN_FEATURES.map((line) => (
          <li key={line} className="flex gap-2 text-sm text-navy/75">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={pending || !chosen}
        onClick={() => chosen && onPay(chosen.duration)}
        className={cn(authButton, "mt-6")}
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Lock className="h-4 w-4" aria-hidden />
        )}
        {chosen ? `Pay ${chosen.price} securely` : "Pay securely"}
      </button>
      <p className="mt-3 text-center text-xs text-navy/55">
        Secure payment by Stripe. One payment, no auto-renewal.
      </p>
      <p className="mt-5 text-center text-sm text-navy/70">
        Not ready to pay?{" "}
        <button
          type="button"
          onClick={onStartFree}
          disabled={pending}
          className="font-bold text-navy underline underline-offset-4"
        >
          Start free instead
        </button>
      </p>
    </>
  );
}

/** Step 3: pick Free or a paid plan; the recommended plan starts selected. */
function PlanStep({
  headingRef,
  childName,
  childId,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  childName: string;
  childId: string | null;
}) {
  const navigate = useNavigate();
  const pricing = usePricePlans();
  const plans = pricing.plans.map(displayPricePlan);
  const recommended = plans.find((plan) => plan.featured) ?? plans[0];
  const [choice, setChoice] = useState<string>(recommended?.duration ?? FREE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = plans.find((plan) => plan.duration === choice);

  const submit = async () => {
    setError(null);
    if (!chosen) {
      await navigate({ to: "/hub" });
      return;
    }
    if (!childId) {
      await navigate({ to: "/subscription", search: { plan: chosen.duration } as never });
      return;
    }
    setPending(true);
    try {
      await checkout(childId, chosen.duration as PlanDuration);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open payment.");
      setPending(false);
    }
  };

  return (
    <>
      <StepHeading ref={headingRef} eyebrow="Step 4 of 4" title="Choose your plan">
        {childName ? `${childName}'s account is ready. ` : "Your account is ready. "}
        Start free, or unlock the full week of guided play.
      </StepHeading>

      <div role="radiogroup" aria-label="Plans" className="mt-6 grid gap-3">
        {plans.map((plan) => (
          <PlanOption
            key={plan.duration}
            selected={choice === plan.duration}
            onSelect={() => setChoice(plan.duration)}
            title={plan.label}
            price={plan.price}
            detail={plan.per}
            badge={plan === recommended ? plan.badge_text || "Recommended" : undefined}
          />
        ))}
        <PlanOption
          selected={choice === FREE}
          onSelect={() => setChoice(FREE)}
          title="Free"
          price="AED 0"
          detail="Browse every Play Plan and try a Play Dose"
        />
      </div>

      {chosen && (
        <ul className="mt-5 grid gap-2">
          {PLAN_FEATURES.map((line) => (
            <li key={line} className="flex gap-2 text-sm text-navy/75">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={pending}
        className={cn(authButton, "mt-6")}
      >
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {chosen ? `Continue to payment — ${chosen.price}` : "Start free"}
      </button>
      <p className="mt-3 text-center text-xs text-navy/55">
        {chosen
          ? "Secure payment by Stripe. Have a coupon? Add it from Subscription later."
          : "You can upgrade any time from Subscription."}
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
        >
          {error}
        </p>
      )}
    </>
  );
}

function PlanOption({
  selected,
  onSelect,
  title,
  price,
  detail,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  price: string;
  detail: string;
  badge?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors",
        selected ? "border-navy bg-navy/[0.04]" : "border-navy/12 bg-white hover:border-navy/30",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-navy bg-navy text-cream" : "border-navy/30",
        )}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-navy">{title}</span>
          {badge && (
            <span className="rounded-full bg-amber px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-navy uppercase">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-navy/60">{detail}</span>
      </span>
      <span className="shrink-0 text-base font-bold text-navy">{price}</span>
    </button>
  );
}

function StepHeading({
  ref,
  eyebrow,
  title,
  children,
}: {
  ref: React.Ref<HTMLHeadingElement>;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p className="text-[11px] font-bold tracking-[0.16em] text-coral uppercase">{eyebrow}</p>
      <h1
        ref={ref}
        tabIndex={-1}
        className="mt-2 text-3xl leading-[1.08] font-bold tracking-tight text-navy outline-none sm:text-[2.1rem]"
      >
        {title}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-navy/70">{children}</p>
    </>
  );
}

/** One short bar per step: done, current and to come. */
function StepProgress({ current }: { current: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-label="Signup progress"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={current}
      aria-valuetext={`Step ${current} of 4`}
    >
      {[1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 w-8 rounded-full transition-colors",
            index < current ? "bg-navy" : index === current ? "bg-coral" : "bg-navy/15",
          )}
        />
      ))}
    </div>
  );
}

function FieldError({ message }: { message?: string | undefined }) {
  return message ? <p className="mt-1 text-xs font-semibold text-coral">{message}</p> : null;
}

function FormError({ errors }: { errors: Record<string, string> }) {
  if (!errors["form"]) return null;
  return (
    <p
      role="alert"
      className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
    >
      {errors["form"]}
      {errors["taken"] && (
        <>
          {" "}
          <Link to="/login" className="font-bold text-navy underline underline-offset-4">
            Log in instead
          </Link>
        </>
      )}
    </p>
  );
}
