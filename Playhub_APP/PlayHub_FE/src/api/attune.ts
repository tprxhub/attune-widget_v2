import { apiRequest, apiStream } from "./client";

/** Attune, the AI play assistant. Conversations are private to the person who asked. */

export interface AttuneStatus {
  enabled: boolean;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  /** On the free plan, where Attune allows fewer questions a day. */
  freePlan: boolean;
  /** What the three ways into Attune are called; a Super Admin can rename them. */
  modeLabels: Record<AttuneMode, string>;
}

/** The three ways into Attune: "Get an idea", "My child is struggling", "What does this mean?". */
export type AttuneMode = "idea" | "regulation" | "progress";

export const ATTUNE_MODES: Record<AttuneMode, { label: string; short: string }> = {
  idea: { label: "Get an idea", short: "Idea" },
  regulation: { label: "My member is struggling", short: "Struggling" },
  progress: { label: "What does this mean?", short: "Progress" },
};

/** A mode's name as set by the Super Admin, or the built-in one until the status has loaded. */
export function attuneModeLabel(mode: AttuneMode, status?: AttuneStatus | null) {
  return status?.modeLabels[mode] || ATTUNE_MODES[mode].label;
}

export function isAttuneMode(value: unknown): value is AttuneMode {
  return value === "idea" || value === "regulation" || value === "progress";
}

/** A source from Attune's clinical register that informed an answer (shown as plain text). */
export interface AttuneReference {
  id: string;
  title: string;
}

export interface AttuneMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  activityId: string | null;
  feedback: "up" | "down" | null;
  mode: AttuneMode | null;
  references: AttuneReference[];
  /** Attune used its safety pathway: show emergency contacts with this answer. */
  safety: boolean;
  createdAt: string;
}

export interface AttuneConversation {
  id: string;
  childId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttuneConversationDetail extends AttuneConversation {
  messages: AttuneMessage[];
}

export interface AttuneAnswer {
  conversation: AttuneConversation;
  question: AttuneMessage;
  answer: AttuneMessage;
  remainingToday: number;
}

interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  activity_id: string | null;
  feedback?: "up" | "down" | null;
  mode?: string | null;
  references?: AttuneReference[];
  safety?: boolean;
  created_at: string;
}

interface ConversationRow {
  id: string;
  child_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

const toMessage = (row: MessageRow): AttuneMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  activityId: row.activity_id,
  feedback: row.feedback ?? null,
  mode: isAttuneMode(row.mode) ? row.mode : null,
  references: row.references ?? [],
  safety: row.safety ?? false,
  createdAt: row.created_at,
});

const toConversation = (row: ConversationRow): AttuneConversation => ({
  id: row.id,
  childId: row.child_id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getAttuneStatus(): Promise<AttuneStatus> {
  const row = await apiRequest<{
    enabled: boolean;
    daily_limit: number;
    used_today: number;
    remaining_today: number;
    free_plan?: boolean;
    mode_labels?: Partial<Record<AttuneMode, string>>;
  }>("/attune/status");
  return {
    enabled: row.enabled,
    dailyLimit: row.daily_limit,
    usedToday: row.used_today,
    remainingToday: row.remaining_today,
    freePlan: row.free_plan ?? false,
    modeLabels: {
      idea: row.mode_labels?.idea || ATTUNE_MODES.idea.label,
      regulation: row.mode_labels?.regulation || ATTUNE_MODES.regulation.label,
      progress: row.mode_labels?.progress || ATTUNE_MODES.progress.label,
    },
  };
}

/** Time until the account's UTC question allowance rolls over at midnight. */
export function getAttuneResetDelay() {
  const now = new Date();
  return (
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime() + 250
  );
}

export async function listAttuneConversations(childId?: string): Promise<AttuneConversation[]> {
  const query = childId ? `?child_id=${encodeURIComponent(childId)}` : "";
  const rows = await apiRequest<ConversationRow[]>(`/attune/conversations${query}`);
  return rows.map(toConversation);
}

export async function getAttuneConversation(id: string): Promise<AttuneConversationDetail> {
  const row = await apiRequest<ConversationRow & { messages: MessageRow[] }>(
    `/attune/conversations/${encodeURIComponent(id)}`,
  );
  return { ...toConversation(row), messages: row.messages.map(toMessage) };
}

export async function rateAttuneAnswer(
  messageId: string,
  value: "up" | "down" | null,
): Promise<AttuneMessage> {
  const row = await apiRequest<MessageRow>(
    `/attune/messages/${encodeURIComponent(messageId)}/feedback`,
    { method: "PUT", body: JSON.stringify({ value }) },
  );
  return toMessage(row);
}

export async function renameAttuneConversation(
  id: string,
  title: string,
): Promise<AttuneConversation> {
  const row = await apiRequest<ConversationRow>(`/attune/conversations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
  return toConversation(row);
}

export interface AttuneInsights {
  questionsToday: number;
  questions7Days: number;
  questions30Days: number;
  people30Days: number;
  children30Days: number;
  ratedUp: number;
  ratedDown: number;
  /** Answers that used the safety pathway in the last 30 days. */
  safety30Days: number;
  /** Answers shared as a handover note in the last 30 days. */
  shared30Days: number;
  daily: { date: string; questions: number }[];
}

/** Platform-wide Attune usage for the admin overview (counts only, never chat text). */
export async function getAttuneInsights(): Promise<AttuneInsights> {
  const row = await apiRequest<{
    questions_today: number;
    questions_7_days: number;
    questions_30_days: number;
    people_30_days: number;
    children_30_days: number;
    rated_up: number;
    rated_down: number;
    safety_30_days?: number;
    shared_30_days?: number;
    daily: { date: string; questions: number }[];
  }>("/attune/insights");
  return {
    questionsToday: row.questions_today,
    questions7Days: row.questions_7_days,
    questions30Days: row.questions_30_days,
    people30Days: row.people_30_days,
    children30Days: row.children_30_days,
    ratedUp: row.rated_up,
    ratedDown: row.rated_down,
    safety30Days: row.safety_30_days ?? 0,
    shared30Days: row.shared_30_days ?? 0,
    daily: row.daily,
  };
}

export async function deleteAttuneConversation(id: string): Promise<void> {
  await apiRequest<void>(`/attune/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** "Share this": a plain-language handover note of the chat up to this answer. */
export async function summariseAttuneAnswer(messageId: string): Promise<string> {
  const row = await apiRequest<{ summary: string }>(
    `/attune/messages/${encodeURIComponent(messageId)}/summary`,
    { method: "POST" },
  );
  return row.summary;
}

export interface AttuneSource {
  id: string;
  reference: string;
  citation: string;
  status: "loaded" | "cited" | "background" | "proposed";
  statusLabel: string;
  supports: string;
  evidence: string;
  limitations: string;
  licensing: string;
  review: string;
}

/** The versioned clinical source register behind Attune's references (staff only). */
export async function getAttuneSources(): Promise<{ version: string; sources: AttuneSource[] }> {
  const row = await apiRequest<{
    version: string;
    sources: (Omit<AttuneSource, "statusLabel"> & { status_label: string })[];
  }>("/attune/sources");
  return {
    version: row.version,
    sources: row.sources.map(({ status_label, ...source }) => ({
      ...source,
      statusLabel: status_label,
    })),
  };
}

export async function askAttune(input: {
  message: string;
  conversationId?: string | undefined;
  childId?: string | undefined;
  activityId?: string | undefined;
  mode?: AttuneMode | undefined;
}): Promise<AttuneAnswer> {
  const row = await apiRequest<{
    conversation: ConversationRow;
    question: MessageRow;
    answer: MessageRow;
    remaining_today: number;
  }>("/attune/ask", {
    method: "POST",
    body: JSON.stringify({
      message: input.message,
      conversation_id: input.conversationId ?? null,
      child_id: input.childId ?? null,
      activity_id: input.activityId ?? null,
      mode: input.mode ?? null,
    }),
  });
  return {
    conversation: toConversation(row.conversation),
    question: toMessage(row.question),
    answer: toMessage(row.answer),
    remainingToday: row.remaining_today,
  };
}

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "error"; detail: string }
  | {
      type: "done";
      conversation: ConversationRow;
      question: MessageRow;
      answer: MessageRow;
      remaining_today: number;
    };

/**
 * Ask Attune and receive the answer as it is written: `onDelta` gets each new piece of text, and
 * the promise resolves with the saved question and answer once it is complete.
 */
export async function askAttuneStream(
  input: Parameters<typeof askAttune>[0],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<AttuneAnswer> {
  const body = await apiStream("/attune/ask/stream", {
    body: JSON.stringify({
      message: input.message,
      conversation_id: input.conversationId ?? null,
      child_id: input.childId ?? null,
      activity_id: input.activityId ?? null,
      mode: input.mode ?? null,
    }),
    ...(signal ? { signal } : {}),
  });
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "delta") onDelta(event.text);
      else if (event.type === "error") throw new Error(event.detail);
      else {
        return {
          conversation: toConversation(event.conversation),
          question: toMessage(event.question),
          answer: toMessage(event.answer),
          remainingToday: event.remaining_today,
        };
      }
    }
    if (done) throw new Error("Attune couldn’t answer just now. Please try again in a moment.");
  }
}

/** Super Admin: what Attune is told and how it answers. The API key stays on the server. */
export interface AttuneSettings {
  enabled: boolean;
  dailyLimit: number;
  consultUrl: string;
  model: string;
  temperature: number;
  maxAnswerTokens: number;
  instructions: string;
  modeGuidance: Record<AttuneMode, string>;
  modeLabels: Record<AttuneMode, string>;
  safetyOverride: string;
  summaryInstructions: string;
}

export interface AttuneSettingsState {
  settings: AttuneSettings;
  defaults: AttuneSettings;
  /** Settings that differ from the defaults, e.g. "instructions" or "mode_guidance.idea". */
  customised: string[];
  provider: string;
  keyConfigured: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface AttuneSettingsTestResult {
  answer: string;
  references: AttuneReference[];
  safety: boolean;
  seconds: number;
}

interface ApiAttuneSettings {
  enabled: boolean;
  daily_limit: number;
  consult_url: string;
  model: string;
  temperature: number;
  max_answer_tokens: number;
  instructions: string;
  mode_guidance: Record<AttuneMode, string>;
  mode_labels: Record<AttuneMode, string>;
  safety_override: string;
  summary_instructions: string;
}

interface ApiAttuneSettingsState {
  settings: ApiAttuneSettings;
  defaults: ApiAttuneSettings;
  customised: string[];
  provider: string;
  key_configured: boolean;
  updated_at: string | null;
  updated_by_name: string | null;
}

const fromApiSettings = (row: ApiAttuneSettings): AttuneSettings => ({
  enabled: row.enabled,
  dailyLimit: row.daily_limit,
  consultUrl: row.consult_url,
  model: row.model,
  temperature: row.temperature,
  maxAnswerTokens: row.max_answer_tokens,
  instructions: row.instructions,
  modeGuidance: { ...row.mode_guidance },
  modeLabels: { ...row.mode_labels },
  safetyOverride: row.safety_override,
  summaryInstructions: row.summary_instructions,
});

const toApiSettings = (settings: AttuneSettings): ApiAttuneSettings => ({
  enabled: settings.enabled,
  daily_limit: settings.dailyLimit,
  consult_url: settings.consultUrl,
  model: settings.model,
  temperature: settings.temperature,
  max_answer_tokens: settings.maxAnswerTokens,
  instructions: settings.instructions,
  mode_guidance: settings.modeGuidance,
  mode_labels: settings.modeLabels,
  safety_override: settings.safetyOverride,
  summary_instructions: settings.summaryInstructions,
});

const toSettingsState = (row: ApiAttuneSettingsState): AttuneSettingsState => ({
  settings: fromApiSettings(row.settings),
  defaults: fromApiSettings(row.defaults),
  customised: row.customised,
  provider: row.provider,
  keyConfigured: row.key_configured,
  updatedAt: row.updated_at,
  updatedByName: row.updated_by_name,
});

export const ATTUNE_SETTINGS_KEY = ["attune", "settings"] as const;

export async function getAttuneSettings() {
  return toSettingsState(await apiRequest<ApiAttuneSettingsState>("/attune/settings"));
}

export async function saveAttuneSettings(settings: AttuneSettings) {
  return toSettingsState(
    await apiRequest<ApiAttuneSettingsState>("/attune/settings", {
      method: "PUT",
      body: JSON.stringify(toApiSettings(settings)),
    }),
  );
}

export async function resetAttuneSettings() {
  return toSettingsState(
    await apiRequest<ApiAttuneSettingsState>("/attune/settings", { method: "DELETE" }),
  );
}

/** One answer written with draft settings; nothing is saved. */
export async function testAttuneSettings(
  settings: AttuneSettings,
  message: string,
  mode: AttuneMode | null,
) {
  return apiRequest<AttuneSettingsTestResult>("/attune/settings/test", {
    method: "POST",
    body: JSON.stringify({ settings: toApiSettings(settings), message, mode }),
  });
}
