import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  BookOpen,
  Download,
  Languages,
  Lock,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  ArrowUp,
  Check,
  Copy,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import {
  ATTUNE_MODES,
  askAttuneStream,
  isAttuneMode,
  deleteAttuneConversation,
  getAttuneConversation,
  getAttuneResetDelay,
  getAttuneStatus,
  listAttuneConversations,
  rateAttuneAnswer,
  renameAttuneConversation,
  type AttuneConversation,
  type AttuneConversationDetail,
  type AttuneMessage,
  type AttuneMode,
  type AttuneReference,
  type AttuneStatus,
} from "@/api/attune";
import { listRecentAttempts } from "@/api/attempts";
import { Protected } from "@/auth/guards";
import { useCapabilities } from "@/auth/session";
import { AppHeaderControls } from "@/components/AppShell";
import { ConfirmButton } from "@/components/ConfirmButton";
import { AttuneAvatar, AttuneMascot } from "@/features/attune/AttuneAvatar";
import { AttuneReply } from "@/features/attune/AttuneReply";
import {
  ReferencesPanel,
  ReferencesToggle,
  SafetyNotice,
  ShareThisButton,
} from "@/features/attune/AnswerExtras";
import { createStreamBuffer } from "@/features/attune/streamBuffer";
import { groupByDate } from "@/features/attune/groupByDate";
import { useActiveChild } from "@/lib/active-child";
import type { Attempt } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AttuneSearch {
  /** Activity the question is about (from an Activity page); Attune then sees its steps. */
  activity?: string;
  /** That Activity's title, shown on the "Asking about" chip. */
  about?: string;
  /** A question to ask straight away, from an "Ask Attune about this" link elsewhere in Play Hub. */
  q?: string;
  /** The way in: "Get an idea", "My child is struggling" or "What does this mean?". */
  mode?: AttuneMode;
}

export const Route = createFileRoute("/attune")({
  validateSearch: (search: Record<string, unknown>): AttuneSearch => ({
    ...(typeof search["activity"] === "string" ? { activity: search["activity"] } : {}),
    ...(typeof search["about"] === "string" ? { about: search["about"].slice(0, 120) } : {}),
    ...(typeof search["q"] === "string" && search["q"].trim()
      ? { q: search["q"].slice(0, 500) }
      : {}),
    ...(isAttuneMode(search["mode"]) ? { mode: search["mode"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Ask Attune — Play Hub" },
      {
        name: "description",
        content:
          "Attune™, your 24/7 Play Partner: OT-informed play ideas and support for hard moments, built around your child's Play Plan.",
      },
    ],
  }),
  component: () => (
    <Protected>
      <AttunePage />
    </Protected>
  ),
});

function suggestionsFor(
  name: string | undefined,
  aboutActivity: boolean,
  latest?: Pick<Attempt, "activity" | "completionStatus">,
  mode?: AttuneMode,
) {
  const child = name ?? "my child";
  if (mode === "regulation") {
    return [
      {
        title: "Meltdown right now",
        prompt: `${child} is melting down right now. What can I do?`,
      },
      {
        title: "Refusing the Activity",
        prompt: `${child} is refusing the Activity. What might be going on?`,
      },
      {
        title: "Hard to stop and move on",
        prompt: `${child} gets very upset when we have to stop and move on to something else.`,
      },
      { title: "I’m losing my patience", prompt: "Nothing is working and I’m losing my patience." },
    ];
  }
  if (mode === "progress") {
    return [
      {
        title: "This dose’s Support Score",
        prompt: `What does ${child}’s Support Score for this Play Dose mean?`,
      },
      {
        title: "Ready for the next level?",
        prompt: `Is ${child} ready to move up a level, stay, or move down?`,
      },
      {
        title: "What has changed",
        prompt: `What has changed for ${child} across the last few Play Doses?`,
      },
      {
        title: "Mood across Sessions",
        prompt: `What does ${child}’s mood across recent Sessions tell us?`,
      },
    ];
  }
  if (mode === "idea" && !aboutActivity) {
    return [
      {
        title: "An idea for today",
        prompt: `Give me one play idea for ${child} today from the Play Plan.`,
      },
      {
        title: "What comes next",
        prompt: `What should ${child} try next in the Play Plan sequence?`,
      },
      {
        title: "No kit toy today",
        prompt: "We don’t have the kit toy with us today. What else could we use?",
      },
      {
        title: "A free-play idea",
        prompt: `Give me a short free-play idea that practises the same skill for ${child}.`,
      },
    ];
  }
  if (aboutActivity) {
    return [
      { title: "Make it easier", prompt: "How can I make this Activity easier?" },
      { title: "Make it harder", prompt: "How can I make this Activity more challenging?" },
      { title: "Keep them engaged", prompt: `${child} won't stay with it for long. Any ideas?` },
      { title: "Everyday practice", prompt: "How can we use this skill in everyday life?" },
    ];
  }
  return [
    latest
      ? {
          title: `Last Session: ${latest.activity}`,
          prompt:
            latest.completionStatus === "stopped_early"
              ? `${child} stopped early on ${latest.activity} last time. What should I change?`
              : `${child}'s last Session was ${latest.activity}. What should we try next?`,
        }
      : {
          title: "A tricky Session",
          prompt: `Sessions with ${child} have been hard lately. What can I change?`,
        },
    {
      title: "Real-Life Try ideas",
      prompt: `Give me 3 ideas for a Real-Life Try for ${child} this week.`,
    },
    {
      title: "Ready for the next level?",
      prompt: `How do I know when ${child} is ready for the next level?`,
    },
    { title: "How it's going", prompt: "Explain how the recent Sessions are going." },
  ];
}

/** The question being answered right now, or the last one that failed or was stopped. */
type Turn = {
  question: string;
  answer: string;
  state: "streaming" | "failed" | "stopped";
  error?: string;
};

function AttunePage() {
  const { activity, about, q, mode } = Route.useSearch();
  const navigate = useNavigate({ from: "/attune" });
  const queryClient = useQueryClient();
  const { canManageSubscription } = useCapabilities();
  const { activeChild, isLoading: childrenLoading } = useActiveChild();
  const childId = activeChild?.id;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [searchFocus, setSearchFocus] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const status = useQuery({
    queryKey: ["attune", "status"],
    queryFn: getAttuneStatus,
    refetchInterval: () => getAttuneResetDelay(),
  });
  const conversations = useQuery({
    queryKey: ["attune", "conversations", childId ?? "none"],
    queryFn: () => listAttuneConversations(childId),
    enabled: !childrenLoading,
  });
  // The latest Session makes the first suggestion about something that really happened.
  const latestSession = useQuery({
    queryKey: ["attune", "latest-session", childId],
    queryFn: async () => (await listRecentAttempts([childId as string], 1))[0] ?? null,
    enabled: Boolean(childId),
    staleTime: 60_000,
  });
  const conversation = useQuery({
    queryKey: ["attune", "conversation", selectedId],
    queryFn: () => getAttuneConversation(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const openChat = useCallback((id: string | null) => {
    requestVersion.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setSelectedId(id);
    setTurn(null);
    setHistoryOpen(false);
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      window.setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, []);

  // A different child starts a fresh chat for that child.
  useEffect(() => openChat(null), [childId, openChat]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!historyOpen) return;
    const close = (event: globalThis.KeyboardEvent) =>
      event.key === "Escape" && setHistoryOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [historyOpen]);

  const messages = selectedId ? (conversation.data?.messages ?? []) : [];
  const streaming = turn?.state === "streaming";

  const ask = useMutation({
    mutationFn: async ({ message, version }: { message: string; version: number }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const buffer = createStreamBuffer((piece) => {
        if (version !== requestVersion.current || controller.signal.aborted) return;
        setTurn((current) =>
          current?.state === "streaming" ? { ...current, answer: current.answer + piece } : current,
        );
      });
      try {
        return await askAttuneStream(
          {
            message,
            conversationId: selectedId ?? undefined,
            childId: selectedId ? undefined : childId,
            activityId: activity,
            mode,
          },
          (piece) => {
            if (version === requestVersion.current && !controller.signal.aborted)
              buffer.push(piece);
          },
          controller.signal,
        );
      } finally {
        if (version === requestVersion.current && !controller.signal.aborted) buffer.flush();
        else buffer.cancel();
      }
    },
    onMutate: ({ message, version }) => {
      requestVersion.current = version;
      setTurn({ question: message, answer: "", state: "streaming" });
      setDraft("");
    },
    onSuccess: (result, { version }) => {
      if (version !== requestVersion.current) return;
      const previous = queryClient.getQueryData<AttuneConversationDetail>([
        "attune",
        "conversation",
        result.conversation.id,
      ]);
      queryClient.setQueryData<AttuneConversationDetail>(
        ["attune", "conversation", result.conversation.id],
        {
          ...result.conversation,
          messages: [...(previous?.messages ?? []), result.question, result.answer],
        },
      );
      setSelectedId(result.conversation.id);
      setTurn(null);
      queryClient.setQueryData<AttuneStatus>(["attune", "status"], (old) =>
        old ? { ...old, remainingToday: result.remainingToday, usedToday: old.usedToday + 1 } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["attune", "conversations"] });
    },
    onError: (error, { message, version }) => {
      if (version !== requestVersion.current) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        setTurn((current) => (current ? { ...current, state: "stopped" } : current));
        return;
      }
      setTurn({
        question: message,
        answer: "",
        state: "failed",
        error: error instanceof Error ? error.message : "Attune couldn’t answer just now.",
      });
    },
    onSettled: (_result, _error, { version }) => {
      if (version !== requestVersion.current) return;
      abortRef.current = null;
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        composerRef.current?.focus();
      }
    },
  });

  const remove = useMutation({
    mutationFn: deleteAttuneConversation,
    onSuccess: (_, id) => {
      if (selectedId === id) openChat(null);
      queryClient.removeQueries({ queryKey: ["attune", "conversation", id] });
      void queryClient.invalidateQueries({ queryKey: ["attune", "conversations"] });
    },
  });

  const rate = useMutation({
    mutationFn: ({ id, value }: { id: string; value: "up" | "down" | null }) =>
      rateAttuneAnswer(id, value),
    onSuccess: (rated) => {
      if (!selectedId) return;
      queryClient.setQueryData<AttuneConversationDetail>(
        ["attune", "conversation", selectedId],
        (old) =>
          old && {
            ...old,
            messages: old.messages.map((m) => (m.id === rated.id ? rated : m)),
          },
      );
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameAttuneConversation(id, title),
    onSuccess: (renamed) => {
      queryClient.setQueryData<AttuneConversationDetail>(
        ["attune", "conversation", renamed.id],
        (old) => old && { ...old, title: renamed.title },
      );
      void queryClient.invalidateQueries({ queryKey: ["attune", "conversations"] });
    },
  });
  const [renaming, setRenaming] = useState(false);

  // Shortcuts, as in ChatGPT: ⌘/Ctrl+Shift+O new chat, ⌘/Ctrl+Shift+S sidebar, Esc stops an answer.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        openChat(null);
      } else if (mod && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setCollapsed(!collapsed);
      } else if (event.key === "Escape" && abortRef.current && !historyOpen) {
        abortRef.current.abort();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openChat, collapsed, setCollapsed, historyOpen]);

  const enabled = status.data?.enabled ?? false;
  const outOfQuestions = status.data ? status.data.remainingToday <= 0 : false;
  const canAsk = enabled && !outOfQuestions && !ask.isPending;

  function send(text: string) {
    const message = text.trim();
    if (!message || !canAsk) return;
    ask.mutate({ message, version: ++requestVersion.current });
  }

  // A question passed in the link (?q=) is asked once, in a fresh chat, then removed from the URL.
  const askedFromLink = useRef(false);
  useEffect(() => {
    if (
      !q ||
      askedFromLink.current ||
      !status.data?.enabled ||
      status.data.freePlan ||
      childrenLoading
    )
      return;
    askedFromLink.current = true;
    void navigate({ search: ({ q: _q, ...rest }) => rest, replace: true });
    if (status.data.remainingToday > 0) {
      ask.mutate({ message: q.trim(), version: ++requestVersion.current });
    } else setDraft(q);
  }, [q, status.data, childrenLoading, navigate, ask]);

  const empty = messages.length === 0 && !turn && !(selectedId && conversation.isLoading);
  const currentTitle = selectedId
    ? (conversation.data?.title ??
      conversations.data?.find((c) => c.id === selectedId)?.title ??
      "Chat")
    : "New chat";

  if (status.isSuccess && !enabled) {
    return (
      <section className="ph-card m-auto max-w-lg p-8 text-center">
        <AttuneMascot className="mx-auto h-28 w-28" />
        <h1 className="mt-4 text-lg font-bold">Attune is coming soon</h1>
        <p className="mt-2 text-sm text-navy/65">
          Attune isn’t switched on for Play Hub yet. Please check back shortly.
        </p>
      </section>
    );
  }

  if (status.isSuccess && status.data.freePlan) {
    return (
      <section className="ph-card m-auto max-w-lg p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber/20 text-navy">
          <Lock className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold">Attune is locked on the free plan</h1>
        <p className="mt-2 text-sm leading-relaxed text-navy/65">
          Upgrade to ask Attune up to 30 questions each day. Your question allowance refreshes at
          midnight UTC.
        </p>
        {canManageSubscription && (
          <Link
            to="/subscription"
            search={{ checkout: undefined }}
            className="ph-pill mt-5 inline-flex min-h-11 items-center gap-2 bg-coral px-5 text-sm font-bold text-white transition hover:brightness-105"
          >
            See subscription plans
          </Link>
        )}
      </section>
    );
  }

  const sidebar = (panel: "column" | "drawer") => (
    <ChatHistory
      panel={panel}
      onHide={panel === "column" ? () => setCollapsed(true) : () => setHistoryOpen(false)}
      searchFocus={panel === "column" ? searchFocus : 0}
      childName={activeChild?.name}
      conversations={conversations.data}
      loading={conversations.isLoading}
      selectedId={selectedId}
      status={status.data}
      onNewChat={() => openChat(null)}
      onOpen={openChat}
      onDelete={(id) => remove.mutateAsync(id)}
      onRename={(id, title) => rename.mutateAsync({ id, title })}
    />
  );

  const composer = (
    <>
      <Composer
        textareaRef={composerRef}
        value={draft}
        onChange={setDraft}
        onSend={() => send(draft)}
        onStop={() => abortRef.current?.abort()}
        streaming={streaming}
        disabled={!enabled || outOfQuestions}
        canSend={canAsk && Boolean(draft.trim())}
        placeholder={
          outOfQuestions
            ? "You’ve reached today’s question limit. Come back tomorrow."
            : mode === "regulation"
              ? `Tell me what’s happening${activeChild ? ` with ${activeChild.name}` : ""}…`
              : activeChild
                ? `Ask anything about ${activeChild.name}’s play…`
                : "Ask Attune anything about play…"
        }
        chip={
          mode || (activity && about) ? (
            <div className="flex flex-wrap gap-1.5">
              {mode && (
                <span className="ph-pill inline-flex max-w-full items-center gap-1.5 bg-amber/25 py-1 pr-1 pl-3 text-xs font-bold text-navy">
                  <span className="truncate">{ATTUNE_MODES[mode].label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      void navigate({ search: ({ mode: _mode, ...rest }) => rest, replace: true })
                    }
                    aria-label={`Stop: ${ATTUNE_MODES[mode].label}`}
                    className="ph-pill grid h-5 w-5 shrink-0 place-items-center hover:bg-amber/40"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              )}
              {activity && about && (
                <span className="ph-pill inline-flex max-w-full items-center gap-1.5 bg-blue/10 py-1 pr-1 pl-3 text-xs font-bold text-blue">
                  <span className="truncate">Asking about: {about}</span>
                  <button
                    type="button"
                    onClick={() =>
                      void navigate({
                        search: ({ activity: _a, about: _b, ...rest }) => rest,
                        replace: true,
                      })
                    }
                    aria-label="Stop asking about this Activity"
                    className="ph-pill grid h-5 w-5 shrink-0 place-items-center hover:bg-blue/15"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              )}
            </div>
          ) : null
        }
      />
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 bg-card">
      {/* History: a column on large screens, a drawer on smaller ones */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden border-r border-navy/8 bg-cream/60 transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-14" : "w-72",
        )}
        aria-label="Your chats with Attune"
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 py-3">
            <RailButton label="Open sidebar" onClick={() => setCollapsed(false)}>
              <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
            </RailButton>
            <RailButton label="New chat" onClick={() => openChat(null)}>
              <SquarePen className="h-[18px] w-[18px]" aria-hidden />
            </RailButton>
            <RailButton
              label="Search chats"
              onClick={() => {
                setCollapsed(false);
                setSearchFocus((n) => n + 1);
              }}
            >
              <Search className="h-[18px] w-[18px]" aria-hidden />
            </RailButton>
          </div>
        ) : (
          sidebar("column")
        )}
      </aside>
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Your chats with Attune"
        >
          <div
            aria-hidden
            onClick={() => setHistoryOpen(false)}
            className="absolute inset-0 bg-navy/40"
          />
          <div className="ph-rise absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-cream shadow-xl">
            {sidebar("drawer")}
          </div>
        </div>
      )}

      <section
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        aria-label="Chat with Attune"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 45% at 50% 0%, color-mix(in oklab, var(--amber) 13%, transparent), transparent 70%)",
        }}
      >
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-navy/8 px-3 sm:px-4 lg:min-h-[72px] lg:px-6">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Show chat history"
            className="ph-pill grid h-9 w-9 place-items-center text-navy/70 hover:bg-navy/6 lg:hidden"
          >
            <History className="h-5 w-5" aria-hidden />
          </button>
          <AttuneAvatar className="hidden h-9 w-9 sm:inline-grid" thinking={streaming} />
          <div className="min-w-0 flex-1">
            {renaming && selectedId ? (
              <InlineRename
                initial={currentTitle}
                label="Chat name"
                onCancel={() => setRenaming(false)}
                onSave={async (title) => {
                  await rename.mutateAsync({ id: selectedId, title });
                  setRenaming(false);
                }}
              />
            ) : (
              <h1 className="truncate text-sm font-bold">{currentTitle}</h1>
            )}
            <p className="flex items-center gap-1.5 truncate text-[11px] text-navy/55">
              <span
                className={cn(
                  "ph-pill h-1.5 w-1.5 shrink-0",
                  streaming ? "animate-pulse bg-amber" : "bg-emerald-500",
                )}
                aria-hidden
              />
              {streaming ? "Attune is writing…" : "Attune™ is ready"}
              {activeChild ? ` · about ${activeChild.name}` : ""}
            </p>
          </div>
          {selectedId && messages.length > 0 && (
            <ChatMenu
              title={currentTitle}
              onRename={() => setRenaming(true)}
              onDownload={() => downloadChat(currentTitle, activeChild?.name, messages)}
              onDelete={() => remove.mutateAsync(selectedId)}
            />
          )}
          <button
            type="button"
            onClick={() => openChat(null)}
            aria-label="New chat"
            title="New chat (⌘⇧O)"
            className="ph-pill grid h-9 w-9 place-items-center text-navy/70 hover:bg-navy/6 lg:hidden"
          >
            <SquarePen className="h-[18px] w-[18px]" aria-hidden />
          </button>
          {/* The app's top-bar controls live here, since this page hides the top bar. */}
          <AppHeaderControls className="hidden shrink-0 lg:flex" />
        </header>

        {empty ? (
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-5 sm:py-8">
            <div className="my-auto w-full max-w-2xl shrink-0">
              <AttuneMascot className="mx-auto h-24 w-24 sm:h-28 sm:w-28" />
              <h2 className="mt-3 text-center text-2xl font-bold sm:text-3xl">
                {emptyHeading(mode, about, activeChild?.name)}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-center text-sm text-navy/60">
                {emptyIntro(mode, activeChild?.name)}
              </p>
              <ul className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] font-bold text-navy/60">
                {[
                  {
                    icon: BookOpen,
                    text: activeChild
                      ? `Knows ${activeChild.name}’s Play Plan`
                      : "Knows the Play Plan",
                  },
                  { icon: ShieldCheck, text: "Chats are private to you" },
                  { icon: Languages, text: "Ask in any language" },
                ].map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="ph-pill inline-flex items-center gap-1.5 border border-navy/10 bg-card/80 px-3 py-1"
                  >
                    <Icon className="h-3.5 w-3.5 text-blue" aria-hidden /> {text}
                  </li>
                ))}
              </ul>
              <div className="mt-6">{composer}</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {suggestionsFor(
                  activeChild?.name,
                  Boolean(activity),
                  latestSession.data ?? undefined,
                  mode,
                ).map((s, index) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => send(s.prompt)}
                    disabled={!canAsk}
                    className="ph-r-xl group relative flex min-h-24 items-start gap-3 border border-navy/10 bg-card px-4 py-3 text-left shadow-sm transition-[background-color,border-color,box-shadow,transform] hover:border-amber/70 hover:bg-amber/8 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue motion-safe:hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    <span
                      className={cn(
                        "ph-pill grid h-9 w-9 shrink-0 place-items-center",
                        [
                          "bg-blue/10 text-blue",
                          "bg-amber/25 text-[#9b6208]",
                          "bg-coral/10 text-coral",
                          "bg-navy/8 text-navy",
                        ][index],
                      )}
                      aria-hidden
                    >
                      {index === 0 ? (
                        <History className="h-4 w-4" />
                      ) : index === 1 ? (
                        <Sparkles className="h-4 w-4" />
                      ) : index === 2 ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-navy">{s.title}</span>
                      <span className="mt-0.5 block text-xs text-navy/55 group-hover:text-navy/70">
                        {s.prompt}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <Disclaimer />
            </div>
          </div>
        ) : (
          <>
            <MessageList
              loading={Boolean(selectedId) && conversation.isLoading}
              messages={messages}
              turn={turn}
              onRetry={() => turn && send(turn.question)}
              canRetry={canAsk}
              onRate={(id, value) => rate.mutate({ id, value })}
            />
            <div className="shrink-0 px-3 pb-3 sm:px-4 sm:pb-4">
              <div className="mx-auto w-full max-w-3xl">
                {composer}
                <Disclaimer />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function emptyHeading(
  mode: AttuneMode | undefined,
  about: string | undefined,
  childName: string | undefined,
) {
  if (mode === "regulation") return "Take a breath. Let’s work through this together.";
  if (mode === "progress")
    return `Let’s make sense of ${childName ? `${childName}’s` : "the"} progress`;
  if (about) return `Questions about “${about}”?`;
  if (mode === "idea") return `Let’s find the right idea${childName ? ` for ${childName}` : ""}`;
  return `Hello, How Can I Help ${childName ?? "Your Child"} Today?`;
}

function emptyIntro(mode: AttuneMode | undefined, childName: string | undefined) {
  const child = childName ? `${childName}’s` : "your child’s";
  if (mode === "regulation")
    return "Tell me what’s happening right now. If anyone may be in danger, call 999 (police) or 998 (ambulance) first.";
  if (mode === "progress")
    return `I’ll explain ${child} Support Score, mood and level in plain words, and what might come next.`;
  if (mode === "idea")
    return "Tell me what you’d like to practise. I’ll suggest one Activity and how to make it easier or harder.";
  return "From choosing the next Play Plan to understanding your child’s progress, I’m here to guide you and answer your questions along the way.";
}

/** Save the open chat as a text file the adult can keep or share with a therapist. */
function downloadChat(title: string, childName: string | undefined, messages: AttuneMessage[]) {
  const lines = [
    `${title}`,
    `Attune™ by The Toy Pharmacy${childName ? ` · about ${childName}` : ""}`,
    `Saved ${new Date().toLocaleString()}`,
    "",
    ...messages.flatMap((m) => [
      `${m.role === "user" ? "You" : "Attune"} · ${new Date(m.createdAt).toLocaleString()}`,
      m.content,
      ...(m.references.length
        ? [`Informed by: ${m.references.map((r) => r.title).join("; ")}`]
        : []),
      "",
    ]),
    DISCLAIMER,
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .slice(0, 60) || "Attune chat"
  }.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function InlineRename({
  initial,
  label,
  onSave,
  onCancel,
}: {
  initial: string;
  label: string;
  onSave: (title: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const title = value.trim();
    if (!title || title === initial) return onCancel();
    setSaving(true);
    try {
      await onSave(title);
    } finally {
      setSaving(false);
    }
  };
  return (
    <input
      aria-label={label}
      value={value}
      autoFocus
      maxLength={160}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void save();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      className="ph-r-md w-full border border-blue/40 bg-card px-2 py-1 text-sm font-bold text-navy focus:outline-none"
    />
  );
}

/** The "…" menu in the chat header: rename, download or delete this chat. */
function ChatMenu({
  title,
  onRename,
  onDownload,
  onDelete,
}: {
  title: string;
  onRename: () => void;
  onDownload: () => void;
  onDelete: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | globalThis.KeyboardEvent) => {
      if (
        event instanceof globalThis.KeyboardEvent
          ? event.key === "Escape"
          : !ref.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  const item =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-semibold text-navy hover:bg-navy/5";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Chat options"
        title="Chat options"
        className="ph-pill grid h-9 w-9 place-items-center text-navy/70 hover:bg-navy/6"
      >
        <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Chat options"
          className="ph-r-xl ph-rise absolute top-11 right-0 z-40 w-52 overflow-hidden border border-navy/10 bg-card py-1 shadow-[var(--shadow-lift)]"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onRename();
            }}
          >
            <Pencil className="h-4 w-4 text-navy/50" aria-hidden /> Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onDownload();
            }}
          >
            <Download className="h-4 w-4 text-navy/50" aria-hidden /> Download chat
          </button>
          <ConfirmButton
            type="button"
            role="menuitem"
            confirmationTitle="Delete this chat?"
            confirmationMessage={`“${title}” will be deleted for good.`}
            confirmLabel="Delete"
            onClick={() => onDelete()}
            className={cn(item, "text-coral hover:bg-coral/5")}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete chat
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

const DISCLAIMER =
  "Attune™ is an OT-informed tool created by a licensed occupational therapist. It gives play ideas, not medical advice. For worries about development, talk to your child’s clinician.";

function Disclaimer() {
  return <p className="mt-2 text-center text-[11px] text-navy/45">{DISCLAIMER}</p>;
}

/** Whether the chat list is folded down to an icon rail; remembered on this device. */
function useSidebarCollapsed(): [boolean, (value: boolean) => void] {
  const key = "playhub:attune:sidebar-collapsed";
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  const update = useCallback((value: boolean) => {
    setCollapsed(value);
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Private browsing: the choice just isn't remembered.
    }
  }, []);
  return [collapsed, update];
}

function RailButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="ph-r-lg grid h-10 w-10 place-items-center text-navy/70 transition hover:bg-navy/6 hover:text-navy"
    >
      {children}
    </button>
  );
}

function ChatHistory({
  panel,
  onHide,
  searchFocus,
  childName,
  conversations,
  loading,
  selectedId,
  status,
  onNewChat,
  onOpen,
  onDelete,
  onRename,
}: {
  panel: "column" | "drawer";
  onHide: () => void;
  /** Bumped by the collapsed rail's search button to focus the search box. */
  searchFocus: number;
  childName: string | undefined;
  conversations: AttuneConversation[] | undefined;
  loading: boolean;
  selectedId: string | null;
  status: AttuneStatus | undefined;
  onNewChat: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<unknown>;
  onRename: (id: string, title: string) => Promise<unknown>;
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchFocus) searchRef.current?.focus();
  }, [searchFocus]);
  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const items = (conversations ?? []).filter(
      (c) => !term || c.title.toLowerCase().includes(term),
    );
    return groupByDate(items);
  }, [conversations, query]);

  return (
    <>
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-2 px-1 pt-1">
          <AttuneAvatar className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Attune™</p>
            <p className="truncate text-[11px] text-navy/50">
              {childName ? `Chats about ${childName}` : "Your chats"}
            </p>
          </div>
          <button
            type="button"
            onClick={onHide}
            aria-label={panel === "column" ? "Close sidebar" : "Close chat history"}
            title={panel === "column" ? "Close sidebar" : "Close"}
            className="ph-r-lg grid h-9 w-9 shrink-0 place-items-center text-navy/60 transition hover:bg-navy/6 hover:text-navy"
          >
            {panel === "column" ? (
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />
            ) : (
              <X className="h-[18px] w-[18px]" aria-hidden />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="ph-r-lg flex min-h-10 w-full items-center gap-2 border border-navy/12 bg-card px-3 text-sm font-bold text-navy transition hover:bg-navy/5"
        >
          <SquarePen className="h-4 w-4" aria-hidden /> New chat
        </button>
        <label className="ph-r-lg flex min-h-9 items-center gap-2 bg-navy/5 px-3 text-sm text-navy/60 focus-within:ring-2 focus-within:ring-blue/30">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Search chats</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-navy placeholder:text-navy/45 focus:outline-none"
          />
        </label>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Past chats">
        {loading ? (
          <div className="space-y-2 px-1">
            <div className="ph-skeleton h-8" />
            <div className="ph-skeleton h-8" />
            <div className="ph-skeleton h-8" />
          </div>
        ) : groups.length ? (
          groups.map((group) => (
            <div key={group.label} className="mt-2 first:mt-0">
              <p className="px-2 pt-2 pb-1 text-[11px] font-bold text-navy/45">{group.label}</p>
              <ul>
                {group.items.map((c) => (
                  <li key={c.id} className="group relative">
                    {editingId === c.id ? (
                      <div className="py-1 pr-1 pl-1">
                        <InlineRename
                          initial={c.title}
                          label={`Rename chat: ${c.title}`}
                          onCancel={() => setEditingId(null)}
                          onSave={async (title) => {
                            await onRename(c.id, title);
                            setEditingId(null);
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpen(c.id)}
                          aria-current={selectedId === c.id ? "page" : undefined}
                          className={cn(
                            "ph-r-md block w-full truncate py-2 pr-16 pl-2 text-left text-sm text-navy/85 transition hover:bg-navy/5",
                            selectedId === c.id && "bg-navy/8 font-semibold text-navy",
                          )}
                        >
                          {c.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(c.id)}
                          aria-label={`Rename chat: ${c.title}`}
                          title="Rename"
                          className="ph-pill absolute top-1/2 right-8 grid h-7 w-7 -translate-y-1/2 place-items-center text-navy/45 transition hover:bg-navy/8 hover:text-navy focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <ConfirmButton
                          type="button"
                          confirmationTitle="Delete this chat?"
                          confirmationMessage={`“${c.title}” will be deleted for good.`}
                          confirmLabel="Delete"
                          onClick={() => onDelete(c.id)}
                          aria-label={`Delete chat: ${c.title}`}
                          title="Delete chat"
                          className="ph-pill absolute top-1/2 right-1 grid h-7 w-7 -translate-y-1/2 place-items-center text-navy/45 transition hover:bg-coral/10 hover:text-coral focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </ConfirmButton>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="px-2 pt-2 text-sm text-navy/55">
            {query ? "No chats match your search." : "No chats yet. Ask your first question."}
          </p>
        )}
      </nav>

      {status && (
        <div className="border-t border-navy/8 px-4 py-3">
          <div className="flex justify-between text-[11px] font-semibold text-navy/55">
            <span>Questions today · resets 00:00 UTC</span>
            <span>
              {status.remainingToday} of {status.dailyLimit} left
            </span>
          </div>
          <div className="ph-pill mt-1.5 h-1.5 overflow-hidden bg-navy/8">
            <div
              className="ph-pill h-full bg-blue transition-[width]"
              style={{
                width: `${Math.min(100, (status.remainingToday / Math.max(1, status.dailyLimit)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

function MessageList({
  loading,
  messages,
  turn,
  onRetry,
  canRetry,
  onRate,
}: {
  loading: boolean;
  messages: AttuneMessage[];
  turn: Turn | null;
  onRetry: () => void;
  canRetry: boolean;
  onRate: (id: string, value: "up" | "down" | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const stick = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });

  // Follow the answer as it streams in, unless the reader has scrolled up to read.
  useEffect(() => {
    if (!stick.current) return;
    const frame = requestAnimationFrame(() =>
      scrollToBottom(turn?.state === "streaming" ? "auto" : "smooth"),
    );
    return () => cancelAnimationFrame(frame);
  }, [messages.length, turn?.answer, turn?.state, loading]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          stick.current = near;
          if (near !== atBottomRef.current) {
            atBottomRef.current = near;
            setAtBottom(near);
          }
        }}
        className="h-full overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6" aria-live="polite">
          {loading && (
            <div className="space-y-3">
              <div className="ph-skeleton ml-auto h-10 w-2/3" />
              <div className="ph-skeleton h-24 w-full" />
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <UserMessage key={m.id} content={m.content} createdAt={m.createdAt} />
            ) : (
              <AssistantMessage
                key={m.id}
                id={m.id}
                content={m.content}
                feedback={m.feedback}
                createdAt={m.createdAt}
                references={m.references}
                safety={m.safety}
                onRate={(value) => onRate(m.id, value)}
              />
            ),
          )}
          {turn && (
            <>
              <UserMessage content={turn.question} />
              {turn.state === "failed" ? (
                <div className="flex gap-3">
                  <AttuneAvatar className="mt-0.5 h-8 w-8" />
                  <div className="ph-r-xl flex-1 border border-coral/25 bg-coral/5 px-4 py-3">
                    <p role="alert" className="text-sm font-semibold text-coral">
                      {turn.error}
                    </p>
                    <button
                      type="button"
                      onClick={onRetry}
                      disabled={!canRetry}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-navy hover:underline disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
                    </button>
                  </div>
                </div>
              ) : (
                <AssistantMessage
                  content={turn.answer}
                  streaming={turn.state === "streaming"}
                  stopped={turn.state === "stopped"}
                />
              )}
            </>
          )}
        </div>
      </div>
      {!atBottom && (
        <button
          type="button"
          onClick={() => {
            stick.current = true;
            atBottomRef.current = true;
            setAtBottom(true);
            scrollToBottom();
          }}
          aria-label="Scroll to the latest message"
          className="ph-pill absolute bottom-3 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center border border-navy/10 bg-card text-navy shadow-[var(--shadow-card)] hover:bg-navy/5"
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

function timeOf(iso: string | undefined) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
}

function UserMessage({ content, createdAt }: { content: string; createdAt?: string }) {
  return (
    <div className="group flex items-end justify-end gap-2">
      {createdAt && (
        <time
          dateTime={createdAt}
          className="mb-1 shrink-0 text-[10px] text-navy/40 opacity-0 transition group-hover:opacity-100"
        >
          {timeOf(createdAt)}
        </time>
      )}
      <p
        dir="auto"
        className="ph-r-3xl max-w-[85%] bg-navy/[0.07] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-navy sm:max-w-[75%]"
      >
        {content}
      </p>
    </div>
  );
}

function AssistantMessage({
  id,
  content,
  streaming = false,
  stopped = false,
  feedback = null,
  createdAt,
  references = [],
  safety = false,
  onRate,
}: {
  /** Saved answers have an id, so they can be shared. */
  id?: string;
  content: string;
  streaming?: boolean;
  stopped?: boolean;
  feedback?: "up" | "down" | null;
  createdAt?: string;
  references?: AttuneReference[];
  safety?: boolean;
  /** Saved answers can be rated; the one still arriving can't. */
  onRate?: (value: "up" | "down" | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const panelId = `attune-references-${id ?? "draft"}`;
  return (
    <div className="group flex gap-3">
      <AttuneAvatar className="mt-0.5 h-8 w-8" thinking={streaming && !content} />
      <div className="min-w-0 flex-1 text-[15px] text-navy">
        {safety && <SafetyNotice />}
        {content ? (
          <AttuneReply text={content} />
        ) : !streaming ? null : (
          <span className="inline-flex h-6 items-center gap-1" aria-label="Attune is thinking">
            <span className="ph-pill h-1.5 w-1.5 animate-bounce bg-navy/40" />
            <span className="ph-pill h-1.5 w-1.5 animate-bounce bg-navy/40 [animation-delay:150ms]" />
            <span className="ph-pill h-1.5 w-1.5 animate-bounce bg-navy/40 [animation-delay:300ms]" />
          </span>
        )}
        {streaming && content && (
          <span
            className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-navy/50 align-text-bottom"
            aria-hidden
          />
        )}
        {stopped && (
          <p className="mt-2 text-xs font-semibold text-navy/50">
            Stopped. This reply wasn’t saved.
          </p>
        )}
        {!streaming && !stopped && content && (
          <div
            className={cn(
              "mt-1 flex gap-1 transition sm:focus-within:opacity-100",
              feedback || showReferences
                ? "opacity-100"
                : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
            )}
          >
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(content).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              aria-label={copied ? "Copied" : "Copy answer"}
              title={copied ? "Copied" : "Copy"}
              className="ph-pill grid h-7 w-7 place-items-center text-navy/50 hover:bg-navy/6 hover:text-navy"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            {onRate &&
              (["up", "down"] as const).map((value) => {
                const Icon = value === "up" ? ThumbsUp : ThumbsDown;
                const chosen = feedback === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onRate(chosen ? null : value)}
                    aria-pressed={chosen}
                    aria-label={value === "up" ? "Helpful answer" : "Not helpful"}
                    title={value === "up" ? "Helpful" : "Not helpful"}
                    className={cn(
                      "ph-pill grid h-7 w-7 place-items-center transition hover:bg-navy/6",
                      chosen
                        ? value === "up"
                          ? "text-blue"
                          : "text-coral"
                        : "text-navy/50 hover:text-navy",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", chosen && "fill-current")} aria-hidden />
                  </button>
                );
              })}
            <ReferencesToggle
              references={references}
              open={showReferences}
              onToggle={() => setShowReferences((v) => !v)}
              panelId={panelId}
            />
            {id && <ShareThisButton messageId={id} />}
            {createdAt && (
              <time dateTime={createdAt} className="ml-1 self-center text-[10px] text-navy/40">
                {timeOf(createdAt)}
              </time>
            )}
          </div>
        )}
        {showReferences && references.length > 0 && (
          <ReferencesPanel references={references} id={panelId} />
        )}
      </div>
    </div>
  );
}

function Composer({
  textareaRef,
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  disabled,
  canSend,
  placeholder,
  chip,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
  canSend: boolean;
  placeholder: string;
  chip: ReactNode;
}) {
  // Grow with the text, up to about eight lines.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value, textareaRef]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="ph-r-3xl border border-navy/15 bg-card p-2 shadow-[var(--shadow-card)] transition focus-within:border-blue/45"
    >
      {chip && <div className="flex px-2 pt-1 pb-1">{chip}</div>}
      <label htmlFor="attune-question" className="sr-only">
        Your question for Attune
      </label>
      <textarea
        id="attune-question"
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        maxLength={2000}
        placeholder={placeholder}
        disabled={disabled}
        className="block max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-base sm:text-[15px] text-navy placeholder:text-navy/45 focus:outline-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-2 px-2 pt-1">
        <span className="text-[11px] text-navy/40">
          {value.length > 1600 ? (
            <span className={value.length >= 2000 ? "font-bold text-coral" : ""}>
              {value.length} / 2000 characters
            </span>
          ) : (
            "Enter to send · Shift + Enter for a new line"
          )}
        </span>
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop answering"
            className="ph-pill grid h-11 w-11 shrink-0 place-items-center bg-navy text-cream transition hover:bg-navy/85"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send question"
            className="ph-pill grid h-11 w-11 shrink-0 place-items-center bg-coral text-white transition active:scale-95 disabled:bg-navy/15 disabled:text-navy/40"
          >
            <ArrowUp className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
