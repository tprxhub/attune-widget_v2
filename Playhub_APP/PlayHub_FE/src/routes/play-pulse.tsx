import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Hand,
  Heart,
  Loader2,
  LockKeyhole,
  MessagesSquare,
  PersonStanding,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import logo from "@/assets/PlayHub_Logo .svg";
import { useSession } from "@/auth/session";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { PulseHeartbeat } from "@/features/play-pulse/PulseHeartbeat";
import {
  AGE_BANDS,
  DEFAULT_OPTIONS,
  DOMAINS,
  PLAY_PULSE_GOALS,
  type AgeBandId,
  type PlayPulseDomain,
  type PlayPulseGoal,
} from "@/features/play-pulse/data";
import {
  bandLabel,
  computePlayPulseResult,
  TIER_COPY,
  type AnswerValue,
  type DomainTier,
  type ScoreTier,
} from "@/features/play-pulse/scoring";
import { sharePlayPulseResult } from "@/features/play-pulse/sharePlayPulse";
import { usePlayPulsePersistence } from "@/features/play-pulse/usePlayPulsePersistence";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  ageBandSelected,
  answerSelected,
  assessmentReset,
  basicsCompleted,
  childNameChanged,
  goalSelected,
  movedBack,
  questionsStarted,
  quizAdvanced,
  resultsRevealed,
  selectPlayPulse,
} from "@/store/play-pulse-slice";

export const Route = createFileRoute("/play-pulse")({
  head: () => ({
    meta: [
      { title: "Play Pulse — Play Hub" },
      {
        name: "description",
        content:
          "A two-minute check-in that shows how much support your child may need for a developmental goal.",
      },
      { property: "og:title", content: "Play Pulse — Play Hub" },
      {
        property: "og:description",
        content: "A quick, goal-based developmental check-in for parents.",
      },
    ],
  }),
  component: PlayPulsePage,
});

const DOMAIN_META: Record<
  PlayPulseDomain,
  { icon: ComponentType<{ className?: string }>; color: string; soft: string }
> = {
  Sensory: { icon: Hand, color: "text-navy", soft: "bg-navy/8" },
  Motor: { icon: PersonStanding, color: "text-coral", soft: "bg-coral/10" },
  Cognition: { icon: Brain, color: "text-[#a76709]", soft: "bg-amber/25" },
  Engagement: { icon: MessagesSquare, color: "text-blue", soft: "bg-blue/10" },
};

const TIER_STYLE: Record<
  DomainTier,
  { text: string; soft: string; border: string; score: string }
> = {
  ontrack: {
    text: "text-[#146334]",
    soft: "bg-[#d6f0e1]",
    border: "border-[#a9d9bd]",
    score: "text-[#146334]",
  },
  practice: {
    text: "text-[#9b6208]",
    soft: "bg-[#ffe0b0]",
    border: "border-[#efc478]",
    score: "text-[#a76709]",
  },
  help: {
    text: "text-[#a8291d]",
    soft: "bg-[#fde7e4]",
    border: "border-[#efb7b1]",
    score: "text-[#b32e22]",
  },
  unknown: {
    text: "text-navy/50",
    soft: "bg-navy/6",
    border: "border-navy/10",
    score: "text-navy/50",
  },
};

const TOTAL_STEPS = 6;

function PlayPulsePage() {
  usePlayPulsePersistence();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectPlayPulse);
  const { session, signInWithProvider, hydrated: sessionHydrated } = useSession();
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isAnonymous = session.role === "anonymous";
  const goal = PLAY_PULSE_GOALS.find((item) => item.id === state.goalId) ?? null;

  useEffect(() => {
    if (state.screen === "gate" && sessionHydrated && !isAnonymous) dispatch(resultsRevealed());
  }, [dispatch, isAnonymous, sessionHydrated, state.screen]);

  const signInWithGoogleAndReveal = async (credential: string) => {
    setAuthPending(true);
    setAuthError(null);
    try {
      await signInWithProvider("google", credential);
      dispatch(resultsRevealed());
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Google sign-in was unsuccessful.");
    } finally {
      setAuthPending(false);
    }
  };

  if (!state.hydrated || !sessionHydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <div className="flex items-center gap-3 text-sm font-bold text-navy/60">
          <Loader2 className="h-5 w-5 animate-spin text-coral" aria-hidden /> Loading Play Pulse…
        </div>
      </main>
    );
  }

  const screen = state.screen === "results" && isAnonymous ? "gate" : state.screen;
  const progressStep =
    screen === "intro"
      ? 0
      : screen === "goal"
        ? 1
        : screen === "quiz"
          ? 2 + state.domainIndex
          : TOTAL_STEPS;

  return (
    <main className="min-h-screen overflow-x-clip bg-cream text-navy">
      <div className="pointer-events-none fixed inset-0 opacity-60" aria-hidden>
        <span className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-amber/25 blur-3xl" />
        <span className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-blue/10 blur-3xl" />
      </div>

      {/* Stays at the top while scrolling; the heartbeat bar sticks just below it. */}
      <header className="sticky top-0 z-30 border-b border-navy/8 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] w-full max-w-5xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <Link to="/" aria-label="Play Hub home">
            <img src={logo} alt="Play Hub — The Toy Pharmacy" className="h-11 w-auto sm:h-12" />
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-navy/5 px-3 py-2 text-xs font-bold text-navy/65">
            <ShieldCheck className="h-4 w-4 text-blue" aria-hidden />
            <span className="sm:hidden">Private</span>
            <span className="hidden sm:inline">Private on this device</span>
          </span>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-2xl px-4 pt-2 pb-20 sm:px-6 sm:pt-5">
        <PulseHeartbeat step={progressStep} total={TOTAL_STEPS} />

        <div key={`${screen}-${state.domainIndex}`} className="ph-rise mt-4">
          {screen === "intro" && <IntroScreen />}
          {screen === "goal" && <GoalScreen />}
          {screen === "quiz" && goal && state.band && <QuizScreen goal={goal} band={state.band} />}
          {screen === "gate" && goal && (
            <ResultGate
              pending={authPending}
              error={authError}
              onCredential={signInWithGoogleAndReveal}
            />
          )}
          {screen === "results" && goal && state.band && (
            <ResultsScreen goal={goal} band={state.band} />
          )}
        </div>
      </div>
    </main>
  );
}

function IntroScreen() {
  const dispatch = useAppDispatch();
  const { childName, band } = useAppSelector(selectPlayPulse);
  const ready = childName.trim().length > 0 && band;

  return (
    <section>
      <Eyebrow>Play Pulse · Quick Check</Eyebrow>
      <h1 className="mt-3 text-4xl leading-[1.04] font-bold tracking-tight sm:text-5xl">
        Let’s start with the basics
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed font-medium text-blue sm:text-lg">
        A two-minute check-in built around a real developmental goal you’re working on together—not
        a generic milestone list.
      </p>

      <div className="mt-8">
        <label htmlFor="pulse-child-name" className="eyebrow text-blue">
          Child’s name
        </label>
        <input
          id="pulse-child-name"
          value={childName}
          onChange={(event) => dispatch(childNameChanged(event.target.value))}
          maxLength={80}
          autoComplete="off"
          placeholder="e.g. Zayd"
          className="mt-2 min-h-14 w-full rounded-2xl border-2 border-navy/10 bg-white px-4 text-lg font-semibold shadow-[var(--shadow-card)] transition focus:border-amber focus:outline-none"
        />
      </div>

      <fieldset className="mt-7">
        <legend className="eyebrow text-blue">Their age</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {AGE_BANDS.map((item) => (
            <ChoiceCard
              key={item.id}
              selected={band === item.id}
              title={item.label}
              description={item.range}
              onClick={() => dispatch(ageBandSelected(item.id))}
            />
          ))}
        </div>
      </fieldset>

      <PrimaryButton disabled={!ready} onClick={() => dispatch(basicsCompleted())}>
        Choose a goal <ArrowRight className="h-5 w-5" aria-hidden />
      </PrimaryButton>
    </section>
  );
}

function GoalScreen() {
  const dispatch = useAppDispatch();
  const { childName, goalId } = useAppSelector(selectPlayPulse);

  return (
    <section>
      <BackButton />
      <Eyebrow>Step 2 of 2</Eyebrow>
      <h1 className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
        What are you working on together right now?
      </h1>
      <p className="mt-3 text-base leading-relaxed font-medium text-blue">
        Pick the goal closest to what you and {childName || "your child"} are focused on.
      </p>

      <div className="mt-7 grid gap-3">
        {PLAY_PULSE_GOALS.map((goal, index) => (
          <button
            key={goal.id}
            type="button"
            onClick={() => dispatch(goalSelected(goal.id))}
            aria-pressed={goalId === goal.id}
            className={cn(
              "group relative flex min-h-20 w-full items-center gap-4 overflow-hidden rounded-2xl border-2 bg-white p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-amber",
              goalId === goal.id ? "border-amber bg-[#fff8ec]" : "border-navy/8",
            )}
          >
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold",
                index % 3 === 0
                  ? "bg-coral/10 text-coral"
                  : index % 3 === 1
                    ? "bg-blue/10 text-blue"
                    : "bg-amber/30 text-[#986008]",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-navy">{goal.name}</span>
              <span className="mt-1 block text-sm text-navy/55">{goal.clinical}</span>
            </span>
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition",
                goalId === goal.id
                  ? "border-coral bg-coral text-white"
                  : "border-navy/15 text-transparent",
              )}
            >
              <Check className="h-4 w-4" aria-hidden />
            </span>
          </button>
        ))}
      </div>

      <PrimaryButton disabled={!goalId} onClick={() => dispatch(questionsStarted())}>
        Start the quick check <ArrowRight className="h-5 w-5" aria-hidden />
      </PrimaryButton>
    </section>
  );
}

function QuizScreen({ goal, band }: { goal: PlayPulseGoal; band: AgeBandId }) {
  const dispatch = useAppDispatch();
  const { childName, domainIndex, answers } = useAppSelector(selectPlayPulse);
  const { session } = useSession();
  const domain = DOMAINS[domainIndex] ?? DOMAINS[0]!;
  const questions = goal.questions[band][domain];
  const selected = answers[domain];
  const ready = selected.every((answer) => answer !== null);
  const DomainIcon = DOMAIN_META[domain].icon;

  const choose = (questionIndex: 0 | 1, value: Exclude<AnswerValue, null>) => {
    dispatch(answerSelected({ domain, questionIndex, value }));
  };

  return (
    <section>
      <BackButton />
      <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-[var(--shadow-card)]">
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full",
            DOMAIN_META[domain].soft,
            DOMAIN_META[domain].color,
          )}
        >
          <DomainIcon className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-xs font-extrabold tracking-[0.1em] uppercase">{domain}</span>
        <span className="text-xs font-semibold text-navy/45">
          Domain {domainIndex + 1} of {DOMAINS.length}
        </span>
      </div>

      <div className="mt-7 space-y-8">
        {questions.map((question, questionIndex) => {
          const text = typeof question === "string" ? question : question.text;
          const options = typeof question === "string" ? DEFAULT_OPTIONS : question.options;
          return (
            <div
              key={text}
              className={cn(questionIndex > 0 && "border-t border-dashed border-amber/60 pt-8")}
            >
              <p className="eyebrow text-blue">Question {questionIndex + 1} of 2</p>
              <h2 className="mt-2 text-xl leading-snug font-bold sm:text-2xl">
                {personalize(text, childName)}
              </h2>
              <div className="mt-4 grid gap-2.5">
                {options.map((option) => (
                  <ChoiceCard
                    key={option.label}
                    selected={selected[questionIndex] === option.score}
                    title={option.label}
                    compact
                    onClick={() => choose(questionIndex as 0 | 1, option.score)}
                  />
                ))}
                <ChoiceCard
                  selected={selected[questionIndex] === "skipped"}
                  title="Hasn’t had the chance to try this yet"
                  compact
                  muted
                  onClick={() => choose(questionIndex as 0 | 1, "skipped")}
                />
              </div>
            </div>
          );
        })}
      </div>

      <PrimaryButton
        disabled={!ready}
        onClick={() => dispatch(quizAdvanced({ revealResult: session.role !== "anonymous" }))}
      >
        {domainIndex === DOMAINS.length - 1 ? "See Support Score" : "Next domain"}
        <ArrowRight className="h-5 w-5" aria-hidden />
      </PrimaryButton>
    </section>
  );
}

function ResultGate({
  pending,
  error,
  onCredential,
}: {
  pending: boolean;
  error: string | null;
  onCredential: (credential: string) => void;
}) {
  return (
    <section>
      <Eyebrow>Your Play Pulse is ready</Eyebrow>
      <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
        One last step to reveal the score
      </h1>
      <p className="mt-4 text-base leading-relaxed font-medium text-blue">
        Sign in with Google to see the Support Score and the four-domain breakdown.
      </p>

      <div className="relative mt-8 overflow-hidden rounded-[28px] border border-navy/8 bg-white p-6 shadow-[0_24px_70px_-30px_rgba(0,42,100,.45)] sm:p-8">
        <div className="pointer-events-none select-none blur-[7px]" aria-hidden>
          <p className="eyebrow text-navy/40">Support Score</p>
          <p className="mt-4 text-7xl font-bold text-coral">54%</p>
          <p className="mt-2 text-2xl font-bold">Needs Practice</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {DOMAINS.map((domain) => (
              <div key={domain} className="h-14 rounded-xl bg-navy/8" />
            ))}
          </div>
        </div>
        <div className="absolute inset-0 grid place-items-center bg-white/72 p-6 backdrop-blur-[2px]">
          <div className="w-full min-w-0 max-w-sm text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber text-navy shadow-lg">
              <LockKeyhole className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-bold">Reveal the Support Score</h2>
            <p className="mt-2 text-sm leading-relaxed text-navy/60">
              Your responses stay in this browser. Signing in only confirms who can view the result.
            </p>
            <div className="mt-6 flex min-h-11 justify-center">
              {pending ? (
                <span className="inline-flex items-center gap-2 font-bold text-navy/60">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Signing in…
                </span>
              ) : (
                <GoogleSignInButton onCredential={onCredential} />
              )}
            </div>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      <GateBackButton />
    </section>
  );
}

function GateBackButton() {
  const dispatch = useAppDispatch();
  return (
    <button
      type="button"
      onClick={() => dispatch(movedBack())}
      className="mx-auto mt-6 flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-blue hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Review answers
    </button>
  );
}

function ResultsScreen({ goal, band }: { goal: PlayPulseGoal; band: AgeBandId }) {
  const dispatch = useAppDispatch();
  const { childName, answers } = useAppSelector(selectPlayPulse);
  const result = useMemo(() => computePlayPulseResult(goal, band, answers), [answers, band, goal]);
  const name = childName.trim() || "Your child";
  const tier = TIER_STYLE[result.tier];
  const copy = resultCopy(result.tier, name, goal.name);
  const [shared, setShared] = useState<"idle" | "busy" | "done">("idle");

  const share = async () => {
    setShared("busy");
    try {
      await sharePlayPulseResult({
        childName: name,
        goalName: goal.name,
        ageBand: bandLabel(band),
        supportScore: result.supportScore,
        tier: result.tier,
        domainTiers: result.domainTiers,
        focus:
          result.weakest && result.domainTiers[result.weakest] !== "ontrack"
            ? result.weakest
            : null,
      });
      setShared("done");
      window.setTimeout(() => setShared("idle"), 2000);
    } catch {
      setShared("idle");
    }
  };

  return (
    <section>
      <Eyebrow>Play Pulse</Eyebrow>
      <div className="mt-4 overflow-hidden rounded-[28px] border border-navy/8 bg-white shadow-[0_24px_70px_-30px_rgba(0,42,100,.45)]">
        <div className={cn("relative px-6 pt-14 pb-9 text-center sm:px-10 sm:pt-9", tier.soft)}>
          <Sparkles className="absolute top-6 left-6 h-6 w-6 opacity-35" aria-hidden />
          <button
            type="button"
            onClick={share}
            disabled={shared === "busy"}
            className="ph-pill absolute top-4 right-4 inline-flex items-center gap-1.5 bg-coral px-3.5 py-2 text-xs font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(223,59,45,0.8)] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {shared === "done" ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Share2 className="h-3.5 w-3.5" aria-hidden />
            )}
            {shared === "done" ? "Ready" : "Share"}
          </button>
          <p className="eyebrow text-navy/50">Support Score</p>
          <p className={cn("mt-3 text-7xl leading-none font-bold tracking-tight", tier.score)}>
            {result.supportScore}%
          </p>
          <p className={cn("mt-2 text-2xl font-bold", tier.score)}>
            {TIER_COPY[result.tier].label}
          </p>
          {result.weakest && result.domainTiers[result.weakest] !== "ontrack" && (
            <p
              className={cn(
                "mx-auto mt-5 max-w-lg rounded-full px-4 py-2 text-sm font-bold",
                TIER_STYLE[result.domainTiers[result.weakest]].soft,
                TIER_STYLE[result.domainTiers[result.weakest]].text,
              )}
            >
              To {goal.name}, {name} needs the most support with {result.weakest} skills.
            </p>
          )}
        </div>
        <div className="px-6 py-6 sm:px-8">
          <p className="text-sm leading-relaxed font-medium text-navy/65">
            {resultExplainer(result.tier, name, goal.name, bandLabel(band))}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {DOMAINS.map((domain) => {
          const domainTier = result.domainTiers[domain];
          const style = TIER_STYLE[domainTier];
          const Icon = DOMAIN_META[domain].icon;
          return (
            <div
              key={domain}
              className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-navy/8 bg-white p-4 shadow-[var(--shadow-card)]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    DOMAIN_META[domain].soft,
                    DOMAIN_META[domain].color,
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-bold">{domain}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase",
                  style.soft,
                  style.text,
                  style.border,
                )}
              >
                {domainTier === "unknown" ? "Not yet assessed" : TIER_COPY[domainTier].badge}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-[28px] bg-navy p-6 text-white shadow-[0_24px_60px_-28px_rgba(0,42,100,.65)] sm:p-8">
        <p className="eyebrow text-amber">Your next step</p>
        <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{copy.heading}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{copy.body}</p>
        <div className="mt-6 grid gap-3">
          <a
            href="https://thetoypharmacy.com/products/play-consult-call"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-coral px-5 text-sm font-bold text-white transition hover:-translate-y-0.5"
          >
            Book a Play Consult <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <Link
            to="/plans"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 text-center text-sm font-bold text-white transition hover:bg-white/15"
          >
            <Play className="h-4 w-4" aria-hidden /> Start Your Play Dose: “{goal.name}”
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={() => dispatch(assessmentReset())}
        className="mx-auto mt-7 flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-blue hover:underline"
      >
        <RotateCcw className="h-4 w-4" aria-hidden /> Start a new check
      </button>
    </section>
  );
}

function ChoiceCard({
  selected,
  title,
  description,
  onClick,
  compact = false,
  muted = false,
}: {
  selected: boolean;
  title: string;
  description?: string;
  onClick: () => void;
  compact?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border-2 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-amber",
        compact ? "min-h-14 px-4 py-3" : "min-h-20 p-4",
        muted ? "border-dashed bg-transparent shadow-none" : "bg-white",
        selected ? "border-amber bg-[#fff8ec]" : "border-navy/8",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cn("block leading-snug", compact ? "text-sm font-semibold" : "font-bold")}>
          {title}
        </span>
        {description && (
          <span className="mt-1 block text-xs font-semibold text-navy/50">{description}</span>
        )}
      </span>
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition",
          selected ? "border-coral bg-coral text-white" : "border-navy/15 text-transparent",
        )}
      >
        <Check className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-8 bg-gradient-to-t from-cream via-cream to-transparent pt-5 pb-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-6 text-base font-bold text-white shadow-[0_14px_28px_-12px_rgba(168,41,29,.7)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
      >
        {children}
      </button>
    </div>
  );
}

function BackButton() {
  const dispatch = useAppDispatch();
  return (
    <button
      type="button"
      onClick={() => dispatch(movedBack())}
      className="mb-4 flex min-h-10 w-fit items-center gap-2 text-sm font-bold text-blue hover:underline"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </button>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex rounded-full bg-amber/30 px-3 py-1.5 text-[11px] font-extrabold tracking-[0.12em] text-[#9b6208] uppercase">
      {children}
    </p>
  );
}

function personalize(text: string, childName: string) {
  return text.replace(/your child/gi, childName.trim() || "your child");
}

function resultExplainer(tier: ScoreTier, name: string, goal: string, ageBand: string) {
  if (tier === "ontrack") {
    return `${name}’s skills line up closely with what “${goal}” calls for at the ${ageBand} stage—${name} needs little extra support to get there. This isn’t a pass/fail score; it shows you where things stand today.`;
  }
  if (tier === "practice") {
    return `${name} is showing some of what “${goal}” calls for at the ${ageBand} stage, with a few areas still catching up. Some focused practice at home should help close the gap. This isn’t a pass/fail score; it shows you where to focus next.`;
  }
  return `${name}’s skills are still some way from what “${goal}” calls for at the ${ageBand} stage. That’s completely normal, and it’s a good moment to bring in extra support. This isn’t a pass/fail score; it shows you where to focus next.`;
}

function resultCopy(tier: ScoreTier, name: string, goal: string) {
  if (tier === "ontrack") {
    return {
      heading: "Keep the momentum going",
      body: `${name}’s profile is already close to what “${goal}” needs. A Play Consult can help fine-tune the plan, or jump straight into the matching Play Dose.`,
    };
  }
  if (tier === "practice") {
    return {
      heading: "Let’s keep building together",
      body: `There’s a bit of a gap between where ${name} is now and what “${goal}” calls for. A Play Consult can help target it, or start practicing today with the matching Play Dose.`,
    };
  }
  return {
    heading: "Let’s build a plan together",
    body: `There’s a real gap between where ${name} is now and what “${goal}” calls for. That’s completely normal, and it’s exactly what a Play Consult with Dr. Esther and her team is for.`,
  };
}
