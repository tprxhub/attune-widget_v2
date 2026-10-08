const API_ROOT = (import.meta.env["VITE_API_URL"] || "http://localhost:8000/api/v1").replace(
  /\/$/,
  "",
);
const TOKEN_KEY = "playhub_access_token";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAccessToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return fallback;
  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item ? String(item.msg) : String(item),
      )
      .join("; ");
  }
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { authenticated?: boolean } = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.authenticated !== false && !token) {
    throw new ApiError("Please sign in to continue.", 401);
  }

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, { ...init, headers });
  } catch (error) {
    throw new ApiError(
      error instanceof Error
        ? `Could not reach Play Hub: ${error.message}`
        : "Could not reach Play Hub.",
      0,
    );
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    if (response.status === 401 && init.authenticated !== false) {
      setAccessToken(null);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("playhub:unauthorized"));
    }
    throw new ApiError(
      errorMessage(payload, `Request failed (${response.status})`),
      response.status,
      payload,
    );
  }
  return payload as T;
}

export function apiAssetUrl(path?: string | null) {
  if (!path || /^(https?:|blob:|data:)/i.test(path)) return path ?? undefined;
  const assetPath = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:/i.test(API_ROOT)) return `${new URL(API_ROOT).origin}${assetPath}`;
  return typeof window === "undefined" ? assetPath : `${window.location.origin}${assetPath}`;
}

export interface ApiToken {
  access_token: string;
  token_type: "bearer";
}

export type ApiRole = "super_admin" | "ttp_employee" | "admin" | "moderator" | "member";
export type ApiScope = "platform" | "organisation" | "individual";

export interface ApiUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  avatar_sticker: string | null;
  role: ApiRole;
  account_scope: ApiScope;
  organisation_id: string | null;
  is_active: boolean;
  created_at: string;
  permissions?: string[];
}

export interface ApiSubscription {
  id: string;
  status: "free" | "active" | "cancelled" | "expired";
  plan_name: string | null;
  started_on: string | null;
  ends_on: string | null;
  payment_managed: boolean;
  refundable_until: string | null;
  renewal_open?: boolean;
}

export interface ApiChild {
  id: string;
  name: string;
  date_of_birth: string | null;
  colour_token: string | null;
  account_scope: ApiScope;
  organisation_id: string | null;
  owner_id: string | null;
  owner_email: string | null;
  admin_id: string | null;
  moderator_id: string | null;
  current_play_dose_id: string | null;
  free_play_plan_id?: string | null;
  plan_started_at: string | null;
  notes: string | null;
  is_active: boolean;
  subscription: ApiSubscription | null;
}

export interface ApiActivity {
  id: string;
  play_dose_id: string;
  sequence: number;
  day: number | null;
  kind: "introduction" | "activity" | "redo" | "level_up";
  title: string;
  instructions: string[];
  instructions_html?: string | null;
  video_source_type: "link" | "upload" | null;
  video_url: string | null;
  duration_minutes: number | null;
  is_loggable: boolean;
  is_real_life_try: boolean;
}

export interface ApiDose {
  id: string;
  play_plan_id: string;
  level: "rookie" | "starter" | "pro";
  title: string;
  summary: string | null;
  thumbnail_url: string | null;
  age_guidance: string | null;
  safety_note: string | null;
  sort_order: number;
  is_active: boolean;
  created_by_name?: string | null;
  activities: ApiActivity[];
}

export interface ApiPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  icon: string | null;
  colour: string | null;
  is_active: boolean;
  publication_status: "published" | "invisible" | "locked";
  access_locked?: boolean;
  sort_order?: number;
  created_by_name?: string | null;
  play_doses: ApiDose[];
}

export interface ApiAttempt {
  id: string;
  child_id: string;
  play_plan_id: string;
  play_dose_id: string;
  activity_id: string | null;
  occurred_on: string;
  completion_score: number;
  completion_status: "finished" | "stopped_early";
  help_level: "hands_on" | "few_reminders" | "one_reminder" | "independent" | null;
  is_real_life_try: boolean;
  week_number: number;
  run_number: number;
  mood_score: number;
  big_win: string | null;
  notes: string | null;
  source: "play_dose" | "daily_check_in";
  logged_by_id: string;
  logged_by_name: string;
  created_at: string;
}

export interface ApiOrganisation {
  id: string;
  name: string;
  kind: string;
  seat_limit: number;
  billing_cycle: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ApiProgress {
  child_id: string;
  total_attempts: number;
  check_in_count: number;
  activities_completed: number;
  average_completion_score: number | null;
  average_mood_score: number | null;
  support_score: number | null;
  last_check_in: string | null;
  trend: "progress" | "plateau" | "decline" | "insufficient_data";
  headline_status:
    | "first_dose"
    | "progressing"
    | "holding_steady"
    | "needs_check_in"
    | "settling_in"
    | "insufficient_data";
  current_play_plan_id?: string | null;
  fast_track_offered: boolean;
  move_down_offered: boolean;
  reminder_due: boolean;
  weekly_points: Array<{
    week_number: number;
    week_start: string;
    week_end: string;
    play_plan_id: string;
    play_dose_id: string;
    level: "rookie" | "starter" | "pro";
    support_score: number | null;
    average_mood: number | null;
    finished_count: number;
    kit_sessions_logged: number;
    real_life_try_passed: boolean;
    passed: boolean;
    complete: boolean;
    consult_suggested: boolean;
    scenario?: "first" | "settling" | "consult" | "progressing" | "steady" | null;
    days: Array<{
      day: number | null;
      is_try: boolean;
      occurred_on: string;
      finished: boolean;
      help_level: "hands_on" | "few_reminders" | "one_reminder" | "independent" | null;
      score: number | null;
      mood: number | null;
      try_passed: boolean | null;
    }>;
  }>;
  points: Array<{
    attempt_id: string;
    occurred_on: string;
    completion_score: number;
    mood_score: number;
    play_plan_id: string;
    play_dose_id: string;
    activity_id: string | null;
    source: "play_dose" | "daily_check_in";
  }>;
}

export async function refreshAccessToken() {
  const token = await apiRequest<ApiToken>("/auth/refresh", { method: "POST" });
  setAccessToken(token.access_token);
}

export async function login(email: string, password: string) {
  const token = await apiRequest<ApiToken>("/auth/login", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(token.access_token);
  return token;
}

/** Identity providers a family can sign in with, besides email and password. */
export type SocialProvider = "google" | "apple" | "microsoft";

export async function loginWithProvider(
  provider: SocialProvider,
  credential: string,
  name?: string,
) {
  const token = await apiRequest<ApiToken>(`/auth/${provider}`, {
    method: "POST",
    authenticated: false,
    body: JSON.stringify(
      provider === "google" ? { credential } : { credential, name: name ?? null },
    ),
  });
  setAccessToken(token.access_token);
  return token;
}

export async function registerFamilyWithProvider(input: {
  provider: SocialProvider;
  credential: string;
  name?: string | undefined;
  childName: string;
  childDateOfBirth?: string;
}) {
  const token = await apiRequest<ApiToken>(`/auth/${input.provider}/register-family`, {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({
      credential: input.credential,
      ...(input.provider === "google" ? {} : { name: input.name ?? null }),
      child_name: input.childName,
      child_date_of_birth: input.childDateOfBirth ?? null,
    }),
  });
  setAccessToken(token.access_token);
  return token;
}

export async function registerFamily(input: {
  email: string;
  password: string;
  guardianName: string;
  childName: string;
  childDateOfBirth?: string;
}) {
  const token = await apiRequest<ApiToken>("/auth/register-family", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      guardian_name: input.guardianName,
      child_name: input.childName,
      child_date_of_birth: input.childDateOfBirth ?? null,
    }),
  });
  setAccessToken(token.access_token);
  return token;
}

export const getCurrentUser = () => apiRequest<ApiUser>("/auth/me");
export const getApiChildren = () => apiRequest<ApiChild[]>("/children");
