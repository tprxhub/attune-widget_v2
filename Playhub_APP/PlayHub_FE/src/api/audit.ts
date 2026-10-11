import {
  apiRequest,
  getApiChildren,
  type ApiChild,
  type ApiOrganisation,
  type ApiPlan,
  type ApiUser,
} from "./client";
import type { Session } from "@/lib/types";
import { hasPermission } from "@/lib/roles";

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  actor_name?: string | null;
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
export async function getAuditLog(limit = 200, session?: Session): Promise<AuditLogData> {
  const events = await listAuditEvents(limit);
  const safe = async <T>(request: Promise<T[]>): Promise<T[]> => request.catch(() => []);
  const allowed = (...keys: Parameters<typeof hasPermission>[1][]) =>
    !session || keys.some((key) => hasPermission(session, key));
  const [users, children, organisations, plans] = await Promise.all([
    allowed("team", "children", "organisations") ? safe(apiRequest<ApiUser[]>("/users")) : [],
    allowed("children", "progress") ? safe(getApiChildren()) : [],
    allowed("organisations", "team", "children")
      ? safe(apiRequest<ApiOrganisation[]>("/organisations"))
      : [],
    allowed("plans") ? safe(apiRequest<ApiPlan[]>("/play-plans?include_inactive=true")) : [],
  ]);
  return { events, users, children, organisations, plans };
}
