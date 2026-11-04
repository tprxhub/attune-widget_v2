import type { PlayPulseDomain } from "./data";
import type { DomainTier, ScoreTier } from "./scoring";

/**
 * What the Play Pulse result says and its colours, shared by the result card and the image it
 * shares, so the two always match.
 */
export function resultCopy(tier: ScoreTier, childName: string, goalName: string, ageBand: string) {
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

export const PULSE_COLORS = {
  navy: "#13295b",
  muted: "#6b7891",
  label: "#8c9bb5",
  border: "#e3e9f4",
  rule: "#edf1f7",
  footer: "#e8eef9",
  consult: "#cf4a3a",
  consultEdge: "#a3311f",
  good: { bg: "#e6f4ec", text: "#1f7a45" },
  work: { bg: "#fbe9e6", text: "#c4412f" },
  muted_pill: { bg: "#eef0f4", text: "#8a93a6" },
} as const;

/** The big percentage: green on track, amber while there is something to practise, coral for help. */
export const SCORE_HEX: Record<ScoreTier, string> = {
  ontrack: "#2f8a57",
  practice: "#f2b35b",
  help: "#cf4a3a",
};

export const TIER_PILL_HEX: Record<ScoreTier, { bg: string; text: string }> = {
  ontrack: PULSE_COLORS.good,
  practice: PULSE_COLORS.work,
  help: PULSE_COLORS.work,
};

export const DOMAIN_STATUS: Record<DomainTier, { label: string; bg: string; text: string }> = {
  ontrack: { label: "On track", ...PULSE_COLORS.good },
  practice: { label: "Needs work", ...PULSE_COLORS.work },
  help: { label: "Needs help", ...PULSE_COLORS.work },
  unknown: { label: "Not assessed", ...PULSE_COLORS.muted_pill },
};

export const DOMAIN_DOT_HEX: Record<PlayPulseDomain, string> = {
  Sensory: "#13295b",
  Motor: "#3a6db5",
  Cognition: "#cf4a3a",
  Engagement: "#d9a441",
};
