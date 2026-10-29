import { useId, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FlaskConical, KeyRound, Loader2, RotateCcw } from "lucide-react";
import {
  ATTUNE_MODES,
  ATTUNE_SETTINGS_KEY,
  getAttuneSettings,
  resetAttuneSettings,
  saveAttuneSettings,
  testAttuneSettings,
  type AttuneMode,
  type AttuneSettings,
  type AttuneSettingsState,
} from "@/api/attune";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ListSkeleton } from "@/components/Skeletons";
import { ReferencesPanel, SafetyNotice } from "@/features/attune/AnswerExtras";
import { AttuneReply } from "@/features/attune/AttuneReply";
import { PromptEditor } from "@/features/attune/PromptEditor";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/attune-settings")({
  head: () => ({ meta: [{ title: "Attune settings — Play Hub" }] }),
  component: () => (
    <Protected roles={["super_admin"]}>
      <AttuneSettingsPage />
    </Protected>
  ),
});

const MODES = Object.keys(ATTUNE_MODES) as AttuneMode[];
const CONTROL =
  "mt-1.5 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm text-navy outline-none transition focus:ring-2";
const CONTROL_OK = "border-navy/15 focus:border-blue focus:ring-blue/25";
const CONTROL_ERROR = "border-coral focus:border-coral focus:ring-coral/20";

type Errors = Partial<Record<string, string>>;

/** The same checks the server makes, so problems show next to the field before saving. */
function validate(s: AttuneSettings): Errors {
  const errors: Errors = {};
  if (!Number.isInteger(s.dailyLimit) || s.dailyLimit < 0 || s.dailyLimit > 100)
    errors["dailyLimit"] = "A whole number from 0 to 100.";
  if (!/^https:\/\/\S+$/.test(s.consultUrl.trim()))
    errors["consultUrl"] = "A full link starting with https://";
  if (!s.model.trim()) errors["model"] = "Enter the model name.";
  if (!(s.temperature >= 0 && s.temperature <= 1.5)) errors["temperature"] = "From 0 to 1.5.";
  if (!Number.isInteger(s.maxAnswerTokens) || s.maxAnswerTokens < 200 || s.maxAnswerTokens > 8000)
    errors["maxAnswerTokens"] = "A whole number from 200 to 8,000.";
  if (s.instructions.trim().length < 200) errors["instructions"] = "The prompt is too short.";
  else if (!s.instructions.includes("{sources}"))
    errors["instructions"] =
      "Keep {sources}: Attune’s reference list is inserted there, so answers can name their sources.";
  for (const mode of MODES) {
    if (!s.modeLabels[mode].trim()) errors[`label.${mode}`] = "Enter a name.";
    else if (s.modeLabels[mode].length > 60) errors[`label.${mode}`] = "60 characters at most.";
    if (!s.modeGuidance[mode].trim()) errors[`guidance.${mode}`] = "Enter the guidance.";
  }
  if (!s.safetyOverride.trim()) errors["safetyOverride"] = "Enter the safety text.";
  if (!s.summaryInstructions.trim()) errors["summaryInstructions"] = "Enter the instructions.";
  return errors;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function AttuneSettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ATTUNE_SETTINGS_KEY, queryFn: getAttuneSettings });
  const [edits, setEdits] = useState<AttuneSettings | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const applied = (state: AttuneSettingsState, text: string) => {
    queryClient.setQueryData(ATTUNE_SETTINGS_KEY, state);
    // Labels and the daily limit show elsewhere in Play Hub.
    void queryClient.invalidateQueries({ queryKey: ["attune", "status"] });
    setEdits(null);
    setNotice({ kind: "ok", text });
  };
  const save = useMutation({
    mutationFn: saveAttuneSettings,
    onSuccess: (state) =>
      applied(state, "Saved. Attune uses these settings from the next question."),
    onError: (error) => setNotice({ kind: "error", text: error.message }),
  });
  const reset = useMutation({
    mutationFn: resetAttuneSettings,
    onSuccess: (state) => applied(state, "Attune is back to its built-in settings."),
  });

  const saved = query.data;
  const draft = edits ?? saved?.settings;
  const errors = useMemo(() => (draft ? validate(draft) : {}), [draft]);
  const errorCount = Object.keys(errors).length;
  const dirty = Boolean(saved && draft && !same(draft, saved.settings));

  const update = (change: Partial<AttuneSettings>) => {
    if (!draft) return;
    setNotice(null);
    setEdits({ ...draft, ...change });
  };
  const updateMode = (key: "modeGuidance" | "modeLabels", mode: AttuneMode, value: string) => {
    if (draft) update({ [key]: { ...draft[key], [mode]: value } });
  };

  return (
    <>
      <Link
        to="/admin"
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-bold hover:border-navy/40"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Overview
      </Link>
      <PageHeader
        eyebrow="Attune™"
        title="Attune settings"
        description="What Attune is told before every answer, the guidance for each way into it, and how it answers. Changes apply to every question from the moment you save."
      />

      {query.isLoading ? (
        <ListSkeleton rows={4} />
      ) : query.isError || !saved || !draft ? (
        <p className="ph-card p-6 text-sm text-navy/60">Attune’s settings couldn’t be loaded.</p>
      ) : (
        <div className="grid min-w-0 gap-5">
          <StatusCard state={saved} />

          <Section
            title="Availability"
            blurb="Switch Attune off for everyone, change how many questions each person can ask a day, and where a Play Consult is booked."
            changed={
              !same(
                [draft.enabled, draft.dailyLimit, draft.consultUrl],
                [saved.defaults.enabled, saved.defaults.dailyLimit, saved.defaults.consultUrl],
              )
            }
            onReset={() =>
              update({
                enabled: saved.defaults.enabled,
                dailyLimit: saved.defaults.dailyLimit,
                consultUrl: saved.defaults.consultUrl,
              })
            }
          >
            <label className="flex items-start gap-3 rounded-xl border border-navy/12 p-3.5 sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => update({ enabled: event.target.checked })}
                className="mt-0.5 h-5 w-5 accent-[var(--color-navy)]"
              />
              <span>
                <span className="block text-sm font-bold">Attune is switched on</span>
                <span className="block text-xs text-navy/60">
                  When off, people see Attune as unavailable and can’t ask questions. You can still
                  try answers below.
                </span>
              </span>
            </label>
            <NumberField
              label="Questions per person per day"
              value={draft.dailyLimit}
              step={1}
              onChange={(dailyLimit) => update({ dailyLimit })}
              error={errors["dailyLimit"]}
              hint="0 to 100. Families on the free plan can’t ask questions."
            />
            <TextField
              label="Play Consult booking link"
              value={draft.consultUrl}
              onChange={(consultUrl) => update({ consultUrl })}
              error={errors["consultUrl"]}
              hint="Put in place of {consult_url} in the prompt."
            />
          </Section>

          <Section
            title="Model"
            blurb={`Which ${saved.provider === "deepinfra" ? "DeepInfra" : "OpenAI"} model writes the answers. The provider and its API key are set on the server and aren’t shown here.`}
            changed={
              !same(
                [draft.model, draft.temperature, draft.maxAnswerTokens],
                [saved.defaults.model, saved.defaults.temperature, saved.defaults.maxAnswerTokens],
              )
            }
            onReset={() =>
              update({
                model: saved.defaults.model,
                temperature: saved.defaults.temperature,
                maxAnswerTokens: saved.defaults.maxAnswerTokens,
              })
            }
          >
            <TextField
              label="Model name"
              value={draft.model}
              onChange={(model) => update({ model })}
              error={errors["model"]}
              hint={`Exactly as the provider names it. Built-in: ${saved.defaults.model}. Try an answer below before saving a new one.`}
              wide
            />
            <NumberField
              label="Creativity (temperature)"
              value={draft.temperature}
              step={0.1}
              onChange={(temperature) => update({ temperature })}
              error={errors["temperature"]}
              hint={
                saved.provider === "deepinfra"
                  ? "0 to 1.5. Lower is more predictable; 0.6 is the built-in setting."
                  : "Not used by OpenAI’s reasoning models."
              }
            />
            <NumberField
              label="Longest answer (tokens)"
              value={draft.maxAnswerTokens}
              step={100}
              onChange={(maxAnswerTokens) => update({ maxAnswerTokens })}
              error={errors["maxAnswerTokens"]}
              hint="200 to 8,000. About 750 words per 1,000 tokens."
            />
          </Section>

          <Section
            title="Main prompt"
            blurb="Sent before every question: who Attune is, how it thinks, the answer format, guardrails and the safety pathway. The child’s Play Plan, progress and recent Sessions are added after it automatically."
            changed={draft.instructions !== saved.defaults.instructions}
            onReset={() => update({ instructions: saved.defaults.instructions })}
          >
            <TextArea
              label="Prompt"
              value={draft.instructions}
              onChange={(instructions) => update({ instructions })}
              error={errors["instructions"]}
              rows={22}
              hint="{sources} is replaced with Attune’s reference list (keep it). {consult_url} is replaced with the booking link above."
            />
          </Section>

          <Section
            title="Ways into Attune"
            blurb="The three buttons people pick from. The name is what they see; the guidance is added to the prompt when they ask that way."
            changed={
              !same(draft.modeGuidance, saved.defaults.modeGuidance) ||
              !same(draft.modeLabels, saved.defaults.modeLabels)
            }
            onReset={() =>
              update({
                modeGuidance: saved.defaults.modeGuidance,
                modeLabels: saved.defaults.modeLabels,
              })
            }
          >
            {MODES.map((mode) => (
              <fieldset
                key={mode}
                className="grid gap-3 rounded-2xl border border-navy/10 p-4 sm:col-span-2"
              >
                <legend className="px-1 text-xs font-bold tracking-wide text-navy/55 uppercase">
                  {ATTUNE_MODES[mode].short}
                </legend>
                <TextField
                  label="Button name"
                  value={draft.modeLabels[mode]}
                  onChange={(value) => updateMode("modeLabels", mode, value)}
                  error={errors[`label.${mode}`]}
                  limit={60}
                />
                <TextArea
                  label="Guidance added to the prompt"
                  value={draft.modeGuidance[mode]}
                  onChange={(value) => updateMode("modeGuidance", mode, value)}
                  error={errors[`guidance.${mode}`]}
                  rows={7}
                />
              </fieldset>
            ))}
          </Section>

          <Section
            title="Safety check"
            blurb="Added when a question contains words that may mean someone is in danger (for example “not breathing” or “swallowed a battery”). The emergency banner always shows for those questions."
            changed={draft.safetyOverride !== saved.defaults.safetyOverride}
            onReset={() => update({ safetyOverride: saved.defaults.safetyOverride })}
          >
            <TextArea
              label="Safety text"
              value={draft.safetyOverride}
              onChange={(safetyOverride) => update({ safetyOverride })}
              error={errors["safetyOverride"]}
              rows={6}
            />
          </Section>

          <Section
            title="“Share this” note"
            blurb="How Attune writes the handover note a parent can send to a partner, nanny, teacher or therapist."
            changed={draft.summaryInstructions !== saved.defaults.summaryInstructions}
            onReset={() => update({ summaryInstructions: saved.defaults.summaryInstructions })}
          >
            <TextArea
              label="Instructions for the note"
              value={draft.summaryInstructions}
              onChange={(summaryInstructions) => update({ summaryInstructions })}
              error={errors["summaryInstructions"]}
              rows={10}
            />
          </Section>

          <TryPanel settings={draft} blocked={errorCount > 0} keyConfigured={saved.keyConfigured} />

          {/* Room on the right for the floating "Search pages" button, so it never covers Save. */}
          <div className="ph-card sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 py-3.5 pr-16 pl-5 shadow-(--shadow-lift) sm:bottom-3 sm:pr-52">
            <div className="min-w-0 text-sm" role="status" aria-live="polite">
              {notice ? (
                <span
                  className={cn("font-semibold", notice.kind === "ok" ? "text-blue" : "text-coral")}
                >
                  {notice.text}
                </span>
              ) : errorCount > 0 ? (
                <span className="font-semibold text-coral">
                  {errorCount} field{errorCount === 1 ? "" : "s"} need attention before you can
                  save.
                </span>
              ) : dirty ? (
                <span className="font-semibold text-navy">You have unsaved changes.</span>
              ) : (
                <span className="text-navy/55">Everything is saved.</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {saved.customised.length > 0 && !dirty && (
                <ConfirmButton
                  confirmationTitle="Reset Attune?"
                  confirmationMessage="Every Attune setting returns to the built-in version, for every question from now on."
                  confirmLabel="Reset Attune"
                  onClick={() => reset.mutateAsync()}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Reset all to built-in
                </ConfirmButton>
              )}
              {dirty && (
                <ConfirmButton
                  confirmationTitle="Discard changes?"
                  confirmationMessage="Your unsaved Attune changes will be lost."
                  confirmLabel="Discard changes"
                  onClick={() => {
                    setEdits(null);
                    setNotice(null);
                  }}
                  className="inline-flex min-h-10 items-center rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
                >
                  Discard changes
                </ConfirmButton>
              )}
              <ConfirmButton
                confirmationTitle="Apply to every question?"
                confirmationMessage="Everyone who asks Attune gets answers with these settings from the next question. Try an answer first if you changed the prompt or the model."
                confirmLabel="Save and apply"
                disabled={!dirty || errorCount > 0 || save.isPending}
                onClick={() => save.mutateAsync(draft)}
                className="inline-flex min-h-10 items-center rounded-full bg-navy px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </ConfirmButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusCard({ state }: { state: AttuneSettingsState }) {
  return (
    <section
      aria-label="Attune status"
      className="ph-card flex flex-wrap items-center gap-x-6 gap-y-3 p-5 text-sm"
    >
      <span className="inline-flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-navy/50" aria-hidden />
        <span className="font-bold">{state.provider === "deepinfra" ? "DeepInfra" : "OpenAI"}</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
            state.keyConfigured ? "bg-[#d6f0e1] text-[#146334]" : "bg-coral/15 text-coral",
          )}
        >
          {state.keyConfigured ? "API key set" : "No API key on the server"}
        </span>
      </span>
      <span className="text-navy/65">
        {state.customised.length === 0
          ? "Using the built-in settings."
          : `${state.customised.length} setting${state.customised.length === 1 ? "" : "s"} changed from built-in.`}
      </span>
      {state.updatedAt && (
        <span className="text-navy/55">
          Last saved {fmtDateTime(state.updatedAt)}
          {state.updatedByName ? ` by ${state.updatedByName}` : ""}
        </span>
      )}
    </section>
  );
}

function Section({
  title,
  blurb,
  changed,
  onReset,
  children,
}: {
  title: string;
  blurb: string;
  changed: boolean;
  onReset: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="ph-card min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="flex flex-wrap items-center gap-2 text-lg font-bold">
            {title}
            {changed && (
              <span className="rounded-full bg-amber/25 px-2.5 py-0.5 text-[11px] font-bold text-[#9b6208]">
                Changed from built-in
              </span>
            )}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-navy/60">{blurb}</p>
        </div>
        {changed && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Use the built-in ${title.replace(/[“”]/g, "")}`}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-navy/15 px-3 text-xs font-bold hover:border-navy/40"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Use built-in
          </button>
        )}
      </div>
      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FieldShell({
  id,
  label,
  error,
  hint,
  count,
  wide,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  count?: string | undefined;
  wide?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-bold text-navy">
          {label}
        </label>
        {count && (
          <span className="text-[11px] font-semibold text-navy/45 tabular-nums">{count}</span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-coral">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-navy/55">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  limit,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string;
  limit?: number;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      wide={wide}
      count={limit ? `${value.length}/${limit}` : undefined}
    >
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error ? CONTROL_ERROR : CONTROL_OK)}
      />
    </FieldShell>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
  error?: string | undefined;
  hint?: string;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isNaN(value) ? "" : value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error ? CONTROL_ERROR : CONTROL_OK)}
      />
    </FieldShell>
  );
}

/** A long instruction text, edited with list and bold buttons (see PromptEditor). */
function TextArea({
  label,
  value,
  onChange,
  error,
  hint,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string;
  rows: number;
}) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      wide
      count={`${value.length.toLocaleString()} characters`}
    >
      <PromptEditor
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        rows={rows}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
    </FieldShell>
  );
}

/** One answer from the settings as they are on screen, saved or not. Nothing is stored. */
function TryPanel({
  settings,
  blocked,
  keyConfigured,
}: {
  settings: AttuneSettings;
  blocked: boolean;
  keyConfigured: boolean;
}) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<AttuneMode | "">("");
  const id = useId();
  const attempt = useMutation({
    mutationFn: () => testAttuneSettings(settings, message.trim(), mode || null),
  });
  const result = attempt.data;
  return (
    <section aria-labelledby={id} className="ph-card min-w-0 p-5 sm:p-6">
      <h2 id={id} className="flex items-center gap-2 text-lg font-bold">
        <FlaskConical className="h-5 w-5 text-blue" aria-hidden /> Try an answer
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-navy/60">
        Ask a question with the settings on this page, including changes you haven’t saved. Nothing
        is saved and no one else sees it. It has no child context, so it shows the prompt’s own
        behaviour.
      </p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-[1fr_14rem]"
        onSubmit={(event) => {
          event.preventDefault();
          if (message.trim() && !blocked) attempt.mutate();
        }}
      >
        <div className="min-w-0">
          <label htmlFor={`${id}-message`} className="text-xs font-bold">
            Question
          </label>
          <textarea
            id={`${id}-message`}
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="My 5-year-old grips the pencil with his whole fist. What can I try?"
            className={cn(CONTROL, CONTROL_OK, "resize-y")}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-mode`} className="text-xs font-bold">
            Asked as
          </label>
          <select
            id={`${id}-mode`}
            value={mode}
            onChange={(event) => setMode(event.target.value as AttuneMode | "")}
            className={cn(CONTROL, CONTROL_OK)}
          >
            <option value="">A general question</option>
            {MODES.map((value) => (
              <option key={value} value={value}>
                {settings.modeLabels[value] || ATTUNE_MODES[value].label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!message.trim() || blocked || !keyConfigured || attempt.isPending}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {attempt.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {attempt.isPending ? "Writing…" : "Try it"}
          </button>
        </div>
      </form>
      {blocked && (
        <p className="mt-2 text-xs font-semibold text-coral">
          Fix the fields marked above to try an answer.
        </p>
      )}
      {attempt.isError && (
        <p role="alert" className="mt-3 text-sm font-semibold text-coral">
          {attempt.error.message}
        </p>
      )}
      {result && !attempt.isPending && (
        <div
          aria-label="Test answer"
          className="mt-5 rounded-2xl border border-navy/10 bg-cream/40 p-4 sm:p-5"
        >
          <p className="mb-3 text-[11px] font-bold tracking-wide text-navy/50 uppercase">
            Answer · {result.seconds}s · not saved
          </p>
          {result.safety && <SafetyNotice />}
          <AttuneReply text={result.answer} />
          {result.references.length > 0 && (
            <div className="mt-4">
              <ReferencesPanel references={result.references} id={`${id}-refs`} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
