import {
  DEFAULT_OPTIONS,
  DOMAINS,
  PLAY_PULSE_GOALS,
  type AgeBandId,
  type PlayPulseDomain,
} from "./data";
import type { AnswerValue } from "./scoring";

/** One question as the parent saw it and the option they chose (null when skipped). */
export interface PulseResponse {
  domain: PlayPulseDomain;
  question: string;
  answer: string | null;
  score: 15 | 40 | 65 | 90 | "skipped";
}

/**
 * The check's questions and chosen answers in words, from its scores. Each question offers four
 * options with different scores, so a score names exactly one option.
 */
export function pulseResponses(
  goalId: string,
  band: string,
  answers: Partial<Record<string, AnswerValue[]>>,
): PulseResponse[] {
  const goal = PLAY_PULSE_GOALS.find((item) => item.id === goalId);
  const byDomain = goal?.questions[band as AgeBandId];
  if (!byDomain) return [];
  return DOMAINS.flatMap((domain) =>
    byDomain[domain].map((item, index): PulseResponse => {
      const question = typeof item === "string" ? item : item.text;
      const options = typeof item === "string" ? DEFAULT_OPTIONS : item.options;
      const value = answers[domain]?.[index];
      const score =
        value === 15 || value === 40 || value === 65 || value === 90 ? value : "skipped";
      const answer =
        score === "skipped" ? null : (options.find((o) => o.score === score)?.label ?? null);
      return { domain, question, answer, score };
    }),
  );
}
