import { useState } from "react";
import {
  CalendarClock,
  Check,
  Gauge,
  Loader2,
  PartyPopper,
  Share2,
  Sparkles,
  Target,
} from "lucide-react";
import { SupportScoreInfo } from "@/components/SupportScoreInfo";
import progressWordmark from "@/assets/progress-play-wordmark.png";
import { RingMarker } from "@/features/progress/InteractiveProgressRings";
import { HeartMarker, SmileMarker } from "@/features/progress/RingIcons";
import { Confetti, FaceShape, Ring } from "@/features/progress/SupportMoodRings";
import { independence, lightShade } from "@/features/progress/supportMood";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlayPulseDomain } from "./data";
import { ON_TRACK_COLOR, PULSE_FACE, pulseCheer } from "./pulseCheer";
import { TIER_COPY, type DomainTier, type ScoreTier } from "./scoring";
import { sharePlayPulseResult } from "./sharePlayPulse";

const SUPPORT_COLOR = "#2459A0";

const TIER_BADGE: Record<ScoreTier, string> = {
  ontrack: "bg-[#d6f0e1] text-[#146334]",
  practice: "bg-[#ffe0b0] text-[#9b6208]",
  help: "bg-[#fde7e4] text-[#a8291d]",
};

/**
 * The Play Pulse result laid out like the Play Hub Summary on Progress: the summary and two
 * figures on the navy panel, and the shareable celebration rings beside it. The outer ring is
 * independence (100% minus the Support Score), the inner ring how many areas are on track.
 */
export function PulseResultCard({
  childName,
  goalName,
  ageBand,
  supportScore,
  tier,
  domainTiers,
  focus,
}: {
  childName: string;
  goalName: string;
  ageBand: string;
  supportScore: number;
  tier: ScoreTier;
  domainTiers: Record<PlayPulseDomain, DomainTier>;
  focus: PlayPulseDomain | null;
}) {
  const [shared, setShared] = useState<"idle" | "busy" | "done">("idle");
  const [shareError, setShareError] = useState(false);
  const cheer = pulseCheer(childName, goalName, tier, domainTiers, focus);
  const areas = cheer.assessed || 4;
  const independent = Math.round(100 - supportScore);
  const next =
    focus ??
    (Object.keys(domainTiers) as PlayPulseDomain[]).find(
      (domain) => domainTiers[domain] === "help" || domainTiers[domain] === "practice",
    ) ??
    null;

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
    <section className="ph-card mt-4 overflow-hidden bg-navy p-5 text-cream sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 flex-col">
          <p className="eyebrow text-cream/60">Play Pulse result</p>
          <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
            <span className="grid h-16 w-16 place-items-center rounded-xl bg-white">
              <svg viewBox="0 0 60 60" className="h-12 w-12" aria-hidden>
                <FaceShape cx={30} cy={30} r={26} mood={PULSE_FACE[tier]} />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-bold sm:text-3xl">{childName}</h2>
              <span
                className={cn(
                  "mt-3 inline-flex rounded-xl px-3 py-1.5 text-xs font-extrabold tracking-wide uppercase",
                  TIER_BADGE[tier],
                )}
              >
                {TIER_COPY[tier].label}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
            <p className="text-xs font-bold tracking-wide text-cream/60 uppercase">Goal</p>
            <p className="mt-2 break-words text-xl font-bold">{goalName}</p>
            <p className="mt-1 text-sm font-bold text-amber">{ageBand}</p>
            <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold text-cream">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {cheer.onTrack} of {areas} areas on track
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-cream/80">{cheer.message}</p>

          <div className="mt-5 grid gap-3">
            <MiniStat
              icon={Gauge}
              value={`${supportScore}%`}
              label="Support Score"
              sub={`${TIER_COPY[tier].label} · lower means less help needed`}
              info="A lower score is better, meaning your child needs less support."
            />
            <MiniStat
              icon={Target}
              value={next ?? "All set"}
              label={next ? "Next focus" : "Every area on track"}
              sub={next ? `The area to play on first` : "Keep the play going"}
            />
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cream/60 lg:mt-auto lg:pt-4">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            Checked on {fmtDate(localToday())}
          </p>
        </div>

        <div className="ph-r-lg relative isolate flex min-w-0 flex-col overflow-hidden bg-white p-4 text-navy sm:p-6">
          <Confetti />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex w-fit min-w-0 max-w-[calc(100%-3.5rem)] flex-none items-center gap-1.5 break-words rounded-full bg-amber px-3 py-1.5 text-[10px] font-extrabold tracking-[0.12em] uppercase">
              <PartyPopper className="h-3.5 w-3.5 shrink-0" aria-hidden /> Celebrating {childName}!
            </p>
            <button
              type="button"
              onClick={share}
              aria-label={shared === "busy" ? "Preparing share image" : "Share result"}
              title="Share result"
              disabled={shared === "busy"}
              className="ph-pill inline-flex h-11 w-11 items-center justify-center bg-coral text-xs font-bold text-white shadow-sm transition hover:bg-coral/90 disabled:opacity-60"
            >
              {shared === "busy" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : shared === "done" ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>

          <div className="relative mx-auto mt-4 aspect-square w-full max-w-[360px]">
            <svg
              viewBox="0 0 160 160"
              className="h-full w-full"
              role="img"
              aria-label={`Independence Score ${independent}%; ${cheer.onTrack} of ${areas} areas on track`}
            >
              <Ring
                radius={70}
                stroke={12}
                value={independence(supportScore)}
                color={SUPPORT_COLOR}
                track={lightShade(SUPPORT_COLOR)}
              />
              <Ring
                radius={58}
                stroke={12}
                value={cheer.onTrack / areas}
                color={ON_TRACK_COLOR}
                track={lightShade(ON_TRACK_COLOR)}
              />
              {/* Drawn after both rings so neither marker is covered: a red heart at the end of
                  the blue (independence) ring, a yellow smile at the end of the green one. */}
              <RingMarker radius={70} value={independence(supportScore)}>
                <HeartMarker />
              </RingMarker>
              <RingMarker radius={58} value={cheer.onTrack / areas}>
                <SmileMarker />
              </RingMarker>
            </svg>
            <div className="pointer-events-none absolute inset-[25%] flex flex-col items-center justify-center text-center">
              <p className="text-sm font-bold sm:text-base">Let’s</p>
              {/* The same "play" wordmark as the Progress page's rings. */}
              <div className="relative my-1 h-9 w-16 shrink-0 overflow-hidden sm:h-10 sm:w-[4.5rem]">
                <img
                  src={progressWordmark}
                  alt="Play Hub"
                  className="absolute top-0 left-0 h-16 w-16 max-w-none -translate-y-[19%] object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
                />
              </div>
              <p className="text-sm font-bold sm:text-base">again soon!</p>
            </div>
          </div>

          <ul
            aria-label="Chart legend"
            className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-navy/70"
          >
            <li className="flex items-center gap-2">
              <span
                className="ph-pill h-2.5 w-2.5 shrink-0"
                style={{ background: SUPPORT_COLOR }}
                aria-hidden
              />
              Independence Score: {independent}%
              <SupportScoreInfo
                label="What Independence Score means"
                description="Shows how independently your child can play and complete activities."
              />
            </li>
            <li className="flex items-center gap-2">
              <span
                className="ph-pill h-2.5 w-2.5 shrink-0"
                style={{ background: ON_TRACK_COLOR }}
                aria-hidden
              />
              Areas on track: {cheer.onTrack} of {areas}
            </li>
          </ul>
          <p className="mt-2 break-words rounded-xl bg-navy/5 px-4 py-3 text-center text-base font-semibold text-navy/75 sm:text-lg">
            {cheer.headline}
          </p>
          {shareError && (
            <p role="alert" className="mt-3 text-sm text-coral">
              The image could not be prepared. Please try sharing again.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
  sub,
  info,
}: {
  icon: typeof Gauge;
  value: string;
  label: string;
  sub: string;
  info?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2.5 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber text-navy">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-2xl leading-none font-bold">{value}</p>
          <p className="flex items-center gap-1 text-sm font-bold text-cream/85">
            {label}
            {info && <SupportScoreInfo description={info} />}
          </p>
        </div>
        <p className="truncate text-[11px] text-cream/55">{sub}</p>
      </div>
    </div>
  );
}

/** Today's date as YYYY-MM-DD in the visitor's own time zone (toISOString would give UTC). */
function localToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
