import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Info, Loader2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOMAINS, type PlayPulseDomain } from "./data";
import { TIER_COPY, type DomainTier, type ScoreTier } from "./scoring";
import { sharePlayPulseResult } from "./sharePlayPulse";

/** The big percentage: amber while there is something to practise, as in the design. */
const SCORE_COLOR: Record<ScoreTier, string> = {
  ontrack: "text-[#2f8a57]",
  practice: "text-[#f2b35b]",
  help: "text-[#cf4a3a]",
};

const PILL = {
  good: "bg-[#e6f4ec] text-[#1f7a45]",
  work: "bg-[#fbe9e6] text-[#c4412f]",
  muted: "bg-navy/6 text-navy/50",
};

const TIER_PILL: Record<ScoreTier, string> = {
  ontrack: PILL.good,
  practice: PILL.work,
  help: PILL.work,
};

const DOMAIN_PILL: Record<DomainTier, { label: string; className: string }> = {
  ontrack: { label: "On track", className: PILL.good },
  practice: { label: "Needs work", className: PILL.work },
  help: { label: "Needs help", className: PILL.work },
  unknown: { label: "Not assessed", className: PILL.muted },
};

const DOMAIN_DOT: Record<PlayPulseDomain, string> = {
  Sensory: "bg-[#13295b]",
  Motor: "bg-[#3a6db5]",
  Cognition: "bg-[#cf4a3a]",
  Engagement: "bg-[#d9a441]",
};

function resultCopy(tier: ScoreTier, childName: string, goalName: string, ageBand: string) {
  const goal = `“${goalName}”`;
  const notAGrade = "This is not a pass/fail score, it just shows you where to focus next.";
  if (tier === "ontrack") {
    return {
      summary: `At the ${ageBand} stage, ${childName} is showing most of the skills that ${goal} calls for. Regular play at home can help build on them. ${notAGrade}`,
      heading: "Keep the momentum going",
      body: "Your child is doing well with what this skill calls for. Keep it going with the matching Play Dose — or a Play Consult can suggest ways to stretch them further.",
    };
  }
  if (tier === "practice") {
    return {
      summary: `At the ${ageBand} stage, ${childName} is showing some of the skills that ${goal} calls for. Strategic practice in this area at home can help close the gap. ${notAGrade}`,
      heading: "Let’s keep building together",
      body: "There’s a bit of a gap between where your child is now and what this skill calls for. A Play Consult can help target it — or start practising today with the matching Play Dose.",
    };
  }
  return {
    summary: `At the ${ageBand} stage, ${childName} is just starting to show the skills that ${goal} calls for. Strategic practice at home, with the right support, can help close the gap. ${notAGrade}`,
    heading: "Let’s find the right support",
    body: "There’s a gap between where your child is now and what this skill calls for. A Play Consult can help you choose where to start — or begin today with the matching Play Dose.",
  };
}

/**
 * The Play Pulse result: the Support Score and what it means, the four areas, and the next step.
 */
export function PulseResultCard({
  childName,
  goalName,
  ageBand,
  supportScore,
  tier,
  domainTiers,
  focus,
  consultUrl,
  planAction,
}: {
  childName: string;
  goalName: string;
  ageBand: string;
  supportScore: number;
  tier: ScoreTier;
  domainTiers: Record<PlayPulseDomain, DomainTier>;
  focus: PlayPulseDomain | null;
  consultUrl: string;
  /** The matching Play Plan (or a free account for a guest), shown under the consult button. */
  planAction?: ReactNode;
}) {
  const [shared, setShared] = useState<"idle" | "busy" | "done">("idle");
  const [shareError, setShareError] = useState(false);
  // Closed by default; parents open it when they want the explanation.
  const [aboutOpen, setAboutOpen] = useState(false);
  const copy = resultCopy(tier, childName, goalName, ageBand);

  const share = async () => {
    setShared("busy");
    setShareError(false);
    try {
      await sharePlayPulseResult({
        childName,
        goalName,
        ageBand,
        supportScore,
        tier,
        domainTiers,
        focus,
      });
      setShared("done");
      window.setTimeout(() => setShared("idle"), 2000);
    } catch {
      setShared("idle");
      setShareError(true);
    }
  };

  return (
    <>
      <section
        aria-label="Play Pulse result"
        className="mt-3 w-full overflow-hidden rounded-[24px] border border-[#e3e9f4] bg-white shadow-[0_18px_40px_-28px_rgba(19,41,91,.35)]"
      >
        <div className="px-[34px] pt-[38px] pb-6">
          <p className="text-center text-[13px] font-bold tracking-[0.22em] text-[#8c9bb5] uppercase">
            Support Score
          </p>
          <p
            className={cn(
              "mt-2 text-center text-[74px] leading-none font-extrabold tracking-tight",
              SCORE_COLOR[tier],
            )}
          >
            {supportScore}
            <span className="align-top text-[36px]">%</span>
          </p>
          <p className="mt-4 text-center">
            <span
              className={cn(
                "inline-flex rounded-full px-4 py-1 text-[13px] font-extrabold tracking-[0.16em] uppercase",
                TIER_PILL[tier],
              )}
            >
              {TIER_COPY[tier].label}
            </span>
          </p>
          <p className="mt-4 text-base leading-[1.8] text-[#6b7891]">{copy.summary}</p>

          <div className="mt-4 rounded-xl bg-[#f3f6fc]">
            <button
              type="button"
              aria-expanded={aboutOpen}
              aria-controls="support-score-about"
              onClick={() => setAboutOpen((open) => !open)}
              className="flex w-full items-center gap-1.5 rounded-xl px-4 py-3 text-left text-[15px] font-bold text-navy"
            >
              <Info className="h-4 w-4 shrink-0 text-[#3a6db5]" aria-hidden />
              <span className="flex-1">What is the Support Score?</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", aboutOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {aboutOpen && (
              <div id="support-score-about" className="px-4 pb-3">
                <p className="text-sm leading-[1.75] text-navy/75">
                  The Support Score measures how well your child uses their sensory, motor, and
                  cognitive skills to interact, play, and navigate everyday activities.
                </p>
                <p className="mt-2 text-sm leading-[1.75] text-navy/75">
                  A higher score indicates greater independence. Our goal is to help your child
                  build these skills through personalised play plans—so they can become more
                  confident, capable, and independent individuals.
                </p>
              </div>
            )}
          </div>
        </div>

        <ul aria-label="Areas" className="border-t border-[#e3e9f4] px-[34px] py-2">
          {DOMAINS.map((domain) => {
            const pill = DOMAIN_PILL[domainTiers[domain]];
            return (
              <li
                key={domain}
                aria-label={`${domain}: ${pill.label}`}
                className="flex items-center justify-between gap-4 border-b border-[#edf1f7] py-4 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-3.5">
                  <span
                    className={cn("-mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full", DOMAIN_DOT[domain])}
                    aria-hidden
                  />
                  <span className="text-base leading-none font-bold tracking-[0.12em] text-navy uppercase">
                    {domain}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs leading-none font-extrabold tracking-[0.14em] uppercase",
                    pill.className,
                  )}
                >
                  {pill.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="bg-[#e8eef9] px-[34px] pt-6 pb-[34px]">
          <h2 className="text-xl font-bold text-navy">{copy.heading}</h2>
          <p className="mt-2 text-base leading-[1.8] text-[#6b7891]">{copy.body}</p>
          <a
            href={consultUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 flex min-h-12 items-center justify-center rounded-xl border-b-4 border-[#a3311f] bg-[#cf4a3a] px-5 text-base font-extrabold tracking-[0.16em] text-white uppercase transition hover:brightness-105 active:translate-y-0.5 active:border-b-2"
          >
            Book a Play Consult
          </a>
          {planAction && <div className="mt-2.5 grid">{planAction}</div>}
        </div>
      </section>

      <div className="mt-2 flex w-full justify-end">
        <button
          type="button"
          onClick={share}
          disabled={shared === "busy"}
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-blue hover:underline disabled:opacity-60"
        >
          {shared === "busy" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : shared === "done" ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Share2 className="h-4 w-4" aria-hidden />
          )}
          {shared === "busy" ? "Preparing…" : "Share result"}
        </button>
      </div>
      {shareError && (
        <p role="alert" className="text-right text-sm text-coral">
          The image could not be prepared. Please try sharing again.
        </p>
      )}
    </>
  );
}
