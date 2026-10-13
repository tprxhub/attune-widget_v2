import { apiRequest, apiStream } from "./client";

/** Attune, the AI play assistant. Conversations are private to the person who asked. */

export interface AttuneStatus {
  enabled: boolean;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  /** On the free plan, where Attune allows fewer questions a day. */
  freePlan: boolean;
}

export interface AttuneMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  activityId: string | null;
  feedback: "up" | "down" | null;
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
  }>("/attune/status");
  return {
    enabled: row.enabled,
    dailyLimit: row.daily_limit,
    usedToday: row.used_today,
    remainingToday: row.remaining_today,
    freePlan: row.free_plan ?? false,
  };
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
    daily: row.daily,
  };
}

export async function deleteAttuneConversation(id: string): Promise<void> {
  await apiRequest<void>(`/attune/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function askAttune(input: {
  message: string;
  conversationId?: string | undefined;
  childId?: string | undefined;
  activityId?: string | undefined;
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
