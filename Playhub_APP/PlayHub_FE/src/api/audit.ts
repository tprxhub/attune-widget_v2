import {
  apiRequest,
  getApiChildren,
  type ApiChild,
  type ApiOrganisation,
  type ApiPlan,
  type ApiUser,
} from "./client";

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export function listAuditEvents(limit = 100) {
  return apiRequest<AuditEvent[]>(`/audit-events?limit=${limit}`);
}

export interface AuditLogData {
  events: AuditEvent[];
  users: ApiUser[];
  children: ApiChild[];
  organisations: ApiOrganisation[];
  plans: ApiPlan[];
}

/**
 * Loads the append-only events first, plus best-effort reference data used to
 * replace opaque UUIDs with human-readable names in the admin UI.
 */
export async function getAuditLog(limit = 200): Promise<AuditLogData> {
  const events = await listAuditEvents(limit);
  const safe = async <T>(request: Promise<T[]>): Promise<T[]> => request.catch(() => []);
  const [users, children, organisations, plans] = await Promise.all([
    safe(apiRequest<ApiUser[]>("/users")),
    safe(getApiChildren()),
    safe(apiRequest<ApiOrganisation[]>("/organisations")),
    safe(apiRequest<ApiPlan[]>("/play-plans?include_inactive=true")),
  ]);
  return { events, users, children, organisations, plans };
}
