import type { PlayPulseDomain } from "./data";
import type { DomainTier, ScoreTier } from "./scoring";

/** Green, as used for "Loved it" moods and on-track areas. */
export const ON_TRACK_COLOR = "#6FA05A";

/** The face in the middle of the rings: always smiling, broadest when on track. */
export const PULSE_FACE: Record<ScoreTier, number> = { ontrack: 5, practice: 4, help: 4 };

/** Upbeat headline, message and win chips for a Play Pulse result. */
export function pulseCheer(
  name: string,
  goal: string,
  tier: ScoreTier,
  domainTiers: Record<PlayPulseDomain, DomainTier>,
  focus: PlayPulseDomain | null,
) {
  const domains = Object.keys(domainTiers) as PlayPulseDomain[];
  const assessed = domains.filter((domain) => domainTiers[domain] !== "unknown");
  const onTrack = domains.filter((domain) => domainTiers[domain] === "ontrack");
  // Fall back to the first area that still needs work, so the card never says "ready" while
  // an area needs practice.
  const next =
    focus ??
    domains.find((domain) => domainTiers[domain] === "help") ??
    domains.find((domain) => domainTiers[domain] === "practice") ??
    null;
  const headline =
    tier === "ontrack"
      ? `${name} is on track!`
      : tier === "practice"
        ? `${name} is getting there!`
        : `${name}’s journey starts here`;
  const message = next
    ? `For “${goal}”, the next focus is ${next} skills.`
    : `Ready for “${goal}”. Keep the play going!`;
  const wins = onTrack.length
    ? onTrack.map((domain) => `${domain} on track`)
    : ["Every step counts"];
  return { headline, message, wins, onTrack: onTrack.length, assessed: assessed.length };
}
