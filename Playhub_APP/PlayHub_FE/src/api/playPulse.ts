import { apiDownload, apiRequest } from "./client";
import type { AgeBandId, PlayPulseDomain } from "@/features/play-pulse/data";
import type { AnswerValue, DomainTier, ScoreTier } from "@/features/play-pulse/scoring";

/** The details a guest gives before seeing their Play Pulse result. */
export interface PulseContact {
  name: string;
  email: string;
  phone: string;
}

export interface PulseCheck {
  childName: string;
  ageBand: AgeBandId;
  goalId: string;
  supportScore: number;
  tier: ScoreTier;
  areasOnTrack: number;
  areasAssessed: number;
  domainTiers: Record<PlayPulseDomain, DomainTier>;
  answers: Record<PlayPulseDomain, [AnswerValue, AnswerValue]>;
}

/**
 * Save a finished check. Signed-in people are recognised by their session; guests send the form.
 * `website` is a hidden field people never fill in.
 */
export async function savePlayPulseResult(
  check: PulseCheck,
  contact: PulseContact | null,
  website = "",
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/play-pulse/results", {
    method: "POST",
    // Open to guests; a signed-in person's token is still sent, so the check goes to their account.
    authenticated: false,
    body: JSON.stringify({
      contact,
      child_name: check.childName,
      age_band: check.ageBand,
      goal_id: check.goalId,
      support_score: check.supportScore,
      tier: check.tier,
      areas_on_track: check.areasOnTrack,
      areas_assessed: check.areasAssessed,
      domain_tiers: check.domainTiers,
      answers: check.answers,
      website,
    }),
  });
}

export type PulseSource =
  "guest" | "super_admin" | "ttp_employee" | "admin" | "moderator" | "member" | "deleted";

export interface PulseResultRow {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string | null;
  source: PulseSource;
  childName: string;
  ageBand: AgeBandId;
  goalId: string;
  goalName: string;
  supportScore: number;
  tier: ScoreTier;
  areasOnTrack: number;
  areasAssessed: number;
  domainTiers: Record<PlayPulseDomain, DomainTier>;
}

export interface PulseResultPage {
  items: PulseResultRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface PulseFilters {
  q?: string;
  goalId?: string;
  tier?: ScoreTier;
  ageBand?: AgeBandId;
  source?: "guest" | "account";
  dateFrom?: string;
  dateTo?: string;
}

function filterParams(filters: PulseFilters) {
  const params = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    ["q", filters.q?.trim()],
    ["goal_id", filters.goalId],
    ["tier", filters.tier],
    ["age_band", filters.ageBand],
    ["source", filters.source],
    ["date_from", filters.dateFrom],
    ["date_to", filters.dateTo],
  ];
  for (const [key, value] of entries) if (value) params.set(key, value);
  return params;
}

interface ResultRowApi {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  source: PulseSource;
  child_name: string;
  age_band: AgeBandId;
  goal_id: string;
  goal_name: string;
  support_score: number;
  tier: ScoreTier;
  areas_on_track: number;
  areas_assessed: number;
  domain_tiers: Record<PlayPulseDomain, DomainTier>;
}

export async function listPlayPulseResults(
  filters: PulseFilters,
  page: number,
  pageSize: number,
): Promise<PulseResultPage> {
  const params = filterParams(filters);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  const data = await apiRequest<{
    items: ResultRowApi[];
    total: number;
    page: number;
    page_size: number;
    pages: number;
  }>(`/admin/play-pulse/results?${params}`);
  return {
    items: data.items.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      name: row.name,
      email: row.email,
      phone: row.phone,
      source: row.source,
      childName: row.child_name,
      ageBand: row.age_band,
      goalId: row.goal_id,
      goalName: row.goal_name,
      supportScore: row.support_score,
      tier: row.tier,
      areasOnTrack: row.areas_on_track,
      areasAssessed: row.areas_assessed,
      domainTiers: row.domain_tiers,
    })),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    pages: data.pages,
  };
}

/** Export as CSV: the rows matching the filters, or every result. */
export async function exportPlayPulseResults(scope: "filtered" | "all", filters: PulseFilters) {
  const params = scope === "filtered" ? filterParams(filters) : new URLSearchParams();
  params.set("scope", scope);
  const today = new Date().toISOString().slice(0, 10);
  await apiDownload(
    `/admin/play-pulse/results/export?${params}`,
    `play-pulse-${scope}-${today}.csv`,
  );
}
