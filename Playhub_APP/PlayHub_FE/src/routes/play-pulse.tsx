import { ConfirmButton } from "@/components/ConfirmButton";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { listGoals, listPlans } from "@/api/plans";
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
  Mail,
  MessagesSquare,
  PersonStanding,
  Phone,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useApplicationLogo } from "@/api/branding";
import { savePlayPulseResult, type PulseCheck, type PulseContact } from "@/api/playPulse";
import { useSession } from "@/auth/session";
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
import { PulseResultCard } from "@/features/play-pulse/PulseResultCard";
import {
  contactErrors,
  lastSavedCheck,
  markCheckSaved,
  usePulseContact,
} from "@/features/play-pulse/pulseContact";
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
  type PlayPulseState,
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

function questionProgress(state: PlayPulseState) {
  const basics = Number(Boolean(state.childName.trim())) + Number(Boolean(state.band));
  const goal = Number(Boolean(state.goalId) && state.screen !== "intro");
  const answered =
    state.screen === "intro" || state.screen === "goal"
      ? 0
      : DOMAINS.flatMap((domain) => state.answers[domain]).filter((answer) => answer !== null)
          .length;
  return (basics + goal + answered) / (3 + DOMAINS.length * 2);
}

function PlayPulsePage() {
  const logo = useApplicationLogo();
  usePlayPulsePersistence();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectPlayPulse);
  const { session, hydrated: sessionHydrated } = useSession();
  const [contact, setContact] = usePulseContact();
  const isAnonymous = session.role === "anonymous";
  // Signed-in people see the result straight away; guests once they have filled in the form.
  const canSeeResult = !isAnonymous || Boolean(contact);
  const goal = PLAY_PULSE_GOALS.find((item) => item.id === state.goalId) ?? null;
  const screen = state.screen === "results" && !canSeeResult ? "gate" : state.screen;

  useEffect(() => {
    if (state.screen === "gate" && sessionHydrated && contact !== undefined && canSeeResult)
      dispatch(resultsRevealed());
  }, [canSeeResult, contact, dispatch, sessionHydrated, state.screen]);

  // Each step starts at the top, not where the previous one was scrolled to. Again on the next
  // frame, in case the browser's scroll anchoring nudged the page as the new step laid out.
  useLayoutEffect(() => {
    const top = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    top();
    const frame = window.requestAnimationFrame(top);
    return () => window.cancelAnimationFrame(frame);
  }, [screen, state.domainIndex]);

  if (!state.hydrated || !sessionHydrated || contact === undefined) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <div className="flex items-center gap-3 text-sm font-bold text-navy/60">
          <Loader2 className="h-5 w-5 animate-spin text-coral" aria-hidden /> Loading Play Pulse…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-cream text-navy [overflow-anchor:none]">
      <div className="pointer-events-none fixed inset-0 opacity-60" aria-hidden>
        <span className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-amber/25 blur-3xl" />
        <span className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-blue/10 blur-3xl" />
      </div>

      {/* Stays at the top while scrolling; the heartbeat bar sticks just below it. */}
      <header className="sticky top-0 z-30 border-b border-navy/8 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] w-full max-w-5xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <Link to="/" aria-label="Play Hub home">
            <img
              src={logo}
              alt="Play Hub — The Toy Pharmacy"
              className="h-11 max-w-[160px] w-auto object-contain sm:h-12"
            />
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-navy/5 px-3 py-2 text-xs font-bold text-navy/65">
            <ShieldCheck className="h-4 w-4 text-blue" aria-hidden />
            <span className="sm:hidden">Private</span>
            <span className="hidden sm:inline">Private on this device</span>
          </span>
        </div>
      </header>

      <div
        className={cn(
          "relative mx-auto w-full px-4 pt-2 pb-20 sm:px-6 sm:pt-5",
          screen === "results" ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        <PulseHeartbeat
          screenKey={`${screen}-${state.domainIndex}`}
          progress={questionProgress(state)}
        />

        <div key={`${screen}-${state.domainIndex}`} className="ph-rise mt-4">
          {screen === "intro" && <IntroScreen />}
          {screen === "goal" && <GoalScreen />}
          {screen === "quiz" && goal && state.band && (
            <QuizScreen goal={goal} band={state.band} revealResult={canSeeResult} />
          )}
          {screen === "gate" && goal && state.band && (
            <ResultGate
              goal={goal}
              band={state.band}
              onSaved={(details) => {
                setContact(details);
                dispatch(resultsRevealed());
              }}
            />
          )}
          {screen === "results" && goal && state.band && (
            <ResultsScreen
              goal={goal}
              band={state.band}
              contact={isAnonymous ? (contact ?? null) : null}
              onForgetContact={() => setContact(null)}
            />
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

function QuizScreen({
  goal,
  band,
  revealResult,
}: {
  goal: PlayPulseGoal;
  band: AgeBandId;
  revealResult: boolean;
}) {
  const dispatch = useAppDispatch();
  const { childName, domainIndex, answers } = useAppSelector(selectPlayPulse);
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

      <PrimaryButton disabled={!ready} onClick={() => dispatch(quizAdvanced({ revealResult }))}>
        {domainIndex === DOMAINS.length - 1 ? "See Support Score" : "Next domain"}
        <ArrowRight className="h-5 w-5" aria-hidden />
      </PrimaryButton>
    </section>
  );
}

/** The finished check, ready to save, and a fingerprint that tells one check from another. */
function useFinishedCheck(goal: PlayPulseGoal, band: AgeBandId) {
  const { childName, answers } = useAppSelector(selectPlayPulse);
  return useMemo(() => {
    const result = computePlayPulseResult(goal, band, answers);
    const tiers = Object.values(result.domainTiers);
    const check: PulseCheck = {
      childName: childName.trim() || "Your child",
      ageBand: band,
      goalId: goal.id,
      supportScore: result.supportScore,
      tier: result.tier,
      areasOnTrack: tiers.filter((tier) => tier === "ontrack").length,
      areasAssessed: tiers.filter((tier) => tier !== "unknown").length,
      domainTiers: result.domainTiers,
      answers,
    };
    return {
      result,
      check,
      fingerprint: JSON.stringify([childName.trim(), band, goal.id, answers]),
    };
  }, [answers, band, childName, goal]);
}

const EMPTY_CONTACT: PulseContact = { name: "", phone: "", email: "" };

function ResultGate({
  goal,
  band,
  onSaved,
}: {
  goal: PlayPulseGoal;
  band: AgeBandId;
  onSaved: (contact: PulseContact) => void;
}) {
  const { check, fingerprint } = useFinishedCheck(goal, band);
  const [form, setForm] = useState<PulseContact>(EMPTY_CONTACT);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof PulseContact, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (field: keyof PulseContact) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = contactErrors(form);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    const details = {
      name: form.name.trim().replace(/\s+/g, " "),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim().replace(/\s+/g, " "),
    };
    setPending(true);
    try {
      await savePlayPulseResult(check, details, website);
      markCheckSaved(fingerprint);
      onSaved(details);
    } catch (reason) {
      setFailure(
        reason instanceof Error ? reason.message : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section>
      <Eyebrow>Your Play Pulse is ready</Eyebrow>
      <h1 className="mt-3 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
        One last step to reveal the score
      </h1>
      <p className="mt-4 text-base leading-relaxed font-medium text-blue">
        Tell us where to keep {check.childName === "Your child" ? "the" : `${check.childName}’s`}{" "}
        result, then see the Support Score and the four-domain breakdown. No account needed.
      </p>

      <form
        noValidate
        onSubmit={submit}
        className="relative mt-8 overflow-hidden rounded-[28px] border border-navy/8 bg-white p-6 shadow-[0_24px_70px_-30px_rgba(0,42,100,.45)] sm:p-8"
      >
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber text-navy shadow-lg">
            <LockKeyhole className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold">Reveal the Support Score</h2>
            <p className="mt-1 text-sm text-navy/60">All fields are required.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <ContactField
            id="pulse-contact-name"
            label="Your name"
            icon={UserRound}
            value={form.name}
            onChange={set("name")}
            error={errors.name}
            autoComplete="name"
            placeholder="e.g. Sara Khan"
            maxLength={120}
          />
          <ContactField
            id="pulse-contact-phone"
            label="Phone number"
            icon={Phone}
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={set("phone")}
            error={errors.phone}
            autoComplete="tel"
            placeholder="e.g. +971 50 123 4567"
            maxLength={32}
          />
          <ContactField
            id="pulse-contact-email"
            label="Email"
            icon={Mail}
            type="email"
            inputMode="email"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={255}
          />
          {/* Hidden from people; bots that fill in every field give themselves away. */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute -left-[9999px] h-px w-px opacity-0"
          />
        </div>

        {failure && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral"
          >
            {failure}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-6 text-base font-bold text-white shadow-[0_14px_28px_-12px_rgba(168,41,29,.7)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Saving…
            </>
          ) : (
            <>
              See the Support Score <ArrowRight className="h-5 w-5" aria-hidden />
            </>
          )}
        </button>
        <p className="mt-4 text-center text-xs leading-relaxed text-navy/55">
          We keep these details with your Play Pulse results and may contact you about Play Hub. See
          our{" "}
          <Link to="/policies/privacy-policy" className="font-bold text-blue underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <GateBackButton />
    </section>
  );
}

function ContactField({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  error,
  ...input
}: {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  type?: string;
  inputMode?: "tel" | "email" | "text";
  autoComplete: string;
  placeholder: string;
  maxLength: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-navy">
        {label}{" "}
        <span className="text-coral" aria-hidden>
          *
        </span>
      </label>
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute top-1/2 left-4 h-4.5 w-4.5 -translate-y-1/2 text-navy/40" />
        <input
          id={id}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "min-h-13 w-full rounded-2xl border-2 bg-white pr-4 pl-11 text-base font-semibold transition focus:outline-none",
            error ? "border-coral/60 focus:border-coral" : "border-navy/10 focus:border-amber",
          )}
          {...input}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-coral">
          {error}
        </p>
      )}
    </div>
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

function ResultsScreen({
  goal,
  band,
  contact,
  onForgetContact,
}: {
  goal: PlayPulseGoal;
  band: AgeBandId;
  contact: PulseContact | null;
  onForgetContact: () => void;
}) {
  const dispatch = useAppDispatch();
  const { result, check, fingerprint } = useFinishedCheck(goal, band);
  const name = check.childName;
  const saving = useRef<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // Save each finished check once: guests with the details they gave, signed-in people by account.
  const save = () => {
    if (lastSavedCheck() === fingerprint || saving.current === fingerprint) return;
    saving.current = fingerprint;
    markCheckSaved(fingerprint);
    setSaveFailed(false);
    savePlayPulseResult(check, contact).catch(() => {
      markCheckSaved(null);
      saving.current = null;
      setSaveFailed(true);
    });
  };
  useEffect(save, [fingerprint]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = resultCopy(result.tier);
  // Play Plans need an account, so a guest is offered a free one instead of the plan link.
  const signedIn = useSession().session.role !== "anonymous";
  const catalog = useQuery({
    queryKey: ["plans"],
    queryFn: () => listPlans(),
    enabled: signedIn,
  });
  const goals = useQuery({ queryKey: ["goals"], queryFn: listGoals, enabled: signedIn });
  const normalise = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/colour/g, "color");
  const matchingGoal = goals.data?.find(
    (item) => normalise(item.name) === normalise(goal.clinical),
  );
  const candidates = (catalog.data ?? []).filter(
    (plan) => normalise(plan.title) === normalise(goal.name) || plan.goalId === matchingGoal?.id,
  );
  const matchingPlan = candidates.find((plan) => plan.level === "Starter") ?? candidates[0];
  return (
    <section>
      <Eyebrow>Play Pulse</Eyebrow>
      <PulseResultCard
        childName={name}
        goalName={goal.name}
        ageBand={bandLabel(band)}
        supportScore={result.supportScore}
        tier={result.tier}
        domainTiers={result.domainTiers}
        focus={
          result.weakest && result.domainTiers[result.weakest] !== "ontrack" ? result.weakest : null
        }
      />

      {(contact || saveFailed) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-navy/55">
          {saveFailed ? (
            <>
              <span className="text-coral">This result couldn’t be saved.</span>
              <button type="button" onClick={save} className="font-bold text-blue underline">
                Try again
              </button>
            </>
          ) : (
            contact && (
              <>
                <span>Saved for {contact.name}.</span>
                <button
                  type="button"
                  onClick={onForgetContact}
                  className="font-bold text-blue underline"
                >
                  Not you?
                </button>
              </>
            )
          )}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DOMAINS.map((domain) => {
          const domainTier = result.domainTiers[domain];
          const style = TIER_STYLE[domainTier];
          const Icon = DOMAIN_META[domain].icon;
          return (
            <div
              key={domain}
              className="flex min-h-20 flex-col items-start justify-center gap-3 rounded-2xl border border-navy/8 bg-white p-4 shadow-[var(--shadow-card)]"
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
          {!signedIn ? (
            <Link
              to="/signup"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 text-center text-sm font-bold text-white transition hover:bg-white/15"
            >
              <Play className="h-4 w-4" aria-hidden /> Start the Play Plan free
            </Link>
          ) : matchingPlan ? (
            <Link
              to="/plans/$planId"
              params={{ planId: matchingPlan.id }}
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 text-center text-sm font-bold text-white transition hover:bg-white/15"
            >
              <Play className="h-4 w-4" aria-hidden /> Start Play Plan
            </Link>
          ) : (
            <p className="rounded-xl border border-white/30 p-4 text-center text-sm text-white/80">
              {catalog.isLoading || goals.isLoading
                ? "Finding your Play Plan…"
                : catalog.isError || goals.isError
                  ? "Could not load this Play Plan. Please refresh to try again."
                  : "This Play Plan is coming soon."}
            </p>
          )}
        </div>
      </div>

      <ConfirmButton
        confirmationTitle="Start a new check?"
        confirmationMessage="Your current Play Pulse answers and result will be cleared."
        confirmLabel="Start new check"
        type="button"
        onClick={() => dispatch(assessmentReset())}
        className="mx-auto mt-7 flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-blue hover:underline"
      >
        <RotateCcw className="h-4 w-4" aria-hidden /> Start a new check
      </ConfirmButton>
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

function resultCopy(tier: ScoreTier) {
  if (tier === "ontrack") {
    return {
      heading: "Keep the play going",
      body: "Try the Play Plan to build on these skills.",
    };
  }
  if (tier === "practice") {
    return {
      heading: "A little practice helps",
      body: "Start the Play Plan, or book a consult for guidance.",
    };
  }
  return {
    heading: "Get a helping hand",
    body: "A Play Consult can help you choose where to start.",
  };
}
