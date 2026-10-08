import { useState } from "react";
import { Check, PartyPopper, Share2, Star } from "lucide-react";
import { SupportScoreInfo } from "@/components/SupportScoreInfo";
import { Confetti, FaceShape, Ring } from "@/features/progress/SupportMoodRings";
import { independence } from "@/features/progress/supportMood";
import type { PlayPulseDomain } from "./data";
import { ON_TRACK_COLOR, PULSE_FACE, pulseCheer } from "./pulseCheer";
import { TIER_COPY, type DomainTier, type ScoreTier } from "./scoring";
import { sharePlayPulseResult } from "./sharePlayPulse";

const SUPPORT_COLOR = "#2459A0";

/**
 * The Play Pulse result as a celebration card, matching the one on Progress: the outer ring is
 * the Support Score (fuller means more independent), the inner ring is how many of the four
 * areas are on track. "Share" turns it into an image.
 */
export function PulseResultCard({
  childName,
  goalName,
  ageBand,
  supportScore,
  tier,
  domainTiers,
  focus,
  explainer,
}: {
  childName: string;
  goalName: string;
  ageBand: string;
  supportScore: number;
  tier: ScoreTier;
  domainTiers: Record<PlayPulseDomain, DomainTier>;
  focus: PlayPulseDomain | null;
  explainer: string;
}) {
  const [shared, setShared] = useState<"idle" | "busy" | "done">("idle");
  const cheer = pulseCheer(childName, goalName, tier, domainTiers, focus);

  const share = async () => {
    setShared("busy");
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
    }
  };

  return (
    <div className="relative isolate mt-4 overflow-hidden border border-navy/8 bg-white p-5 text-navy shadow-[0_24px_70px_-30px_rgba(0,42,100,.45)] ph-r-lg sm:p-6">
      <Confetti />
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-amber px-2.5 py-1 text-[10px] font-extrabold tracking-[0.12em] text-navy uppercase shadow-sm">
          <PartyPopper className="h-3.5 w-3.5" aria-hidden /> Play Pulse result
        </p>
        <button
          type="button"
          onClick={share}
          disabled={shared === "busy"}
          className="ph-pill inline-flex shrink-0 items-center gap-1.5 bg-coral px-3.5 py-2 text-xs font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(223,59,45,0.8)] transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {shared === "done" ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Share2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {shared === "done" ? (
            "Ready"
          ) : (
            <>
              <span className="sm:hidden">Share</span>
              <span className="hidden sm:inline">Share the result</span>
            </>
          )}
        </button>
      </div>
      <div className="mt-2">
        <h2 className="text-xl leading-tight font-extrabold sm:text-2xl">{cheer.headline}</h2>
        <p className="mt-0.5 text-sm text-navy/70">{cheer.message}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="relative h-36 w-36 shrink-0 sm:h-40 sm:w-40">
          <svg
            viewBox="0 0 160 160"
            className="h-full w-full"
            role="img"
            aria-label={`Support Score ${supportScore}%; ${cheer.onTrack} of ${cheer.assessed} areas on track`}
          >
            <Ring
              radius={70}
              stroke={16}
              value={independence(supportScore)}
              color={SUPPORT_COLOR}
            />
            <Ring
              radius={52}
              stroke={16}
              value={cheer.assessed ? cheer.onTrack / cheer.assessed : 0}
              color={ON_TRACK_COLOR}
            />
            <FaceShape cx={80} cy={80} r={28} mood={PULSE_FACE[tier]} />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <dl className="space-y-3">
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-bold text-navy/60">
                <span className="ph-pill h-2.5 w-2.5" style={{ background: SUPPORT_COLOR }} />
                Support Score
                <SupportScoreInfo />
              </dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl leading-none font-bold">{supportScore}%</span>
                <span className="text-sm font-bold text-navy/60">{TIER_COPY[tier].label}</span>
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-bold text-navy/60">
                <span className="ph-pill h-2.5 w-2.5" style={{ background: ON_TRACK_COLOR }} />
                Areas on track
              </dt>
              <dd className="mt-1 text-2xl leading-none font-bold">
                {cheer.onTrack} of {cheer.assessed || 4}
              </dd>
            </div>
          </dl>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {cheer.wins.map((win) => (
              <li
                key={win}
                className="ph-pill inline-flex items-center gap-1 border whitespace-nowrap border-navy/10 bg-white px-2.5 py-1 text-[11px] font-bold text-navy"
              >
                <Star className="h-3 w-3 fill-amber text-amber" aria-hidden /> {win}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 border border-navy/8 bg-white px-4 py-3 text-sm leading-relaxed font-medium text-navy/65 ph-r-md">
        {explainer}
      </p>
    </div>
  );
}
