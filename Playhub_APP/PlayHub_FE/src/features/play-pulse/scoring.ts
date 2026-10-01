import {
  AGE_BANDS,
  DOMAINS,
  type AgeBandId,
  type PlayPulseDomain,
  type PlayPulseGoal,
} from "./data";

export type AnswerValue = 15 | 40 | 65 | 90 | "skipped" | null;
export type PlayPulseAnswers = Record<PlayPulseDomain, [AnswerValue, AnswerValue]>;
export type ScoreTier = "ontrack" | "practice" | "help";
export type DomainTier = ScoreTier | "unknown";

export const TIER_COPY: Record<ScoreTier, { label: string; badge: string }> = {
  ontrack: { label: "On Track", badge: "ON TRACK" },
  practice: { label: "Needs Practice", badge: "NEEDS PRACTICE" },
  help: { label: "Needs Help", badge: "NEEDS HELP" },
};

export function emptyAnswers(): PlayPulseAnswers {
  return {
    Sensory: [null, null],
    Motor: [null, null],
    Cognition: [null, null],
    Engagement: [null, null],
  };
}

export function tierFor(readiness: number): ScoreTier {
  if (readiness >= 66) return "ontrack";
  if (readiness >= 33) return "practice";
  return "help";
}

export function domainRawScore(values: [AnswerValue, AnswerValue]): number | null {
  const answered = values.filter((value): value is 15 | 40 | 65 | 90 => typeof value === "number");
  if (!answered.length) return null;
  return answered.reduce((total, value) => total + value, 0) / answered.length;
}

export interface PlayPulseResult {
  readiness: number;
  supportScore: number;
  tier: ScoreTier;
  domainTiers: Record<PlayPulseDomain, DomainTier>;
  normalized: Partial<Record<PlayPulseDomain, number>>;
  weakest: PlayPulseDomain | null;
}

/** Implements the goal-weighted, independently normalized scoring rules from the spec. */
export function computePlayPulseResult(
  goal: PlayPulseGoal,
  band: AgeBandId,
  answers: PlayPulseAnswers,
): PlayPulseResult {
  const formula = goal.formula[band];
  const rawScores = Object.fromEntries(
    DOMAINS.map((domain) => [domain, domainRawScore(answers[domain])]),
  ) as Record<PlayPulseDomain, number | null>;
  const assessed = DOMAINS.filter((domain) => rawScores[domain] !== null);
  const normalized: Partial<Record<PlayPulseDomain, number>> = {};

  for (const domain of assessed) {
    const percentage = ((rawScores[domain]! - 15) / (90 - 15)) * 100;
    normalized[domain] = Math.max(0, Math.min(100, percentage));
  }

  const assessedWeight = assessed.reduce((total, domain) => total + formula[domain], 0);
  const averageWeight = assessedWeight / (assessed.length || 1);
  const weightedReadiness = assessedWeight
    ? assessed.reduce((total, domain) => total + formula[domain] * (normalized[domain] ?? 0), 0) /
      assessedWeight
    : 0;

  const domainTiers = {} as Record<PlayPulseDomain, DomainTier>;
  for (const domain of DOMAINS) {
    if (!assessed.includes(domain)) {
      domainTiers[domain] = "unknown";
      continue;
    }
    let tier = tierFor(normalized[domain] ?? 0);
    if (formula[domain] < averageWeight) {
      if (tier === "help") tier = "practice";
      else if (tier === "practice") tier = "ontrack";
    }
    domainTiers[domain] = tier;
  }

  const weakest = assessed.reduce<PlayPulseDomain | null>((current, domain) => {
    if (!current || (normalized[domain] ?? 0) < (normalized[current] ?? 0)) return domain;
    return current;
  }, null);
  const readiness = Math.round(weightedReadiness);
  const supportScore = Math.round(100 - weightedReadiness);

  return {
    readiness,
    supportScore,
    tier: tierFor(readiness),
    domainTiers,
    normalized,
    weakest,
  };
}

export function bandLabel(band: AgeBandId) {
  return AGE_BANDS.find((item) => item.id === band)?.label ?? "their age group";
}
