import { useEffect, useId, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import {
  DEFAULT_HOMEPAGE_CONTENT,
  HOMEPAGE_LIMITS,
  HOMEPAGE_QUERY_KEY,
  loadHomepage,
  MAX_QUOTES,
  resetHomepage,
  saveHomepage,
  type HomepageContent,
  type HomepageState,
  uploadHomepageImage,
} from "@/api/homepage";
import { apiAssetUrl } from "@/api/client";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/homepage")({
  head: () => ({ meta: [{ title: "Home page editor — Play Hub admin" }] }),
  component: () => (
    <Protected roles={["super_admin", "ttp_employee"]} permission="homepage">
      <HomepageEditor />
    </Protected>
  ),
});

/* ---------- what can be edited ---------- */

type Path = ReadonlyArray<string | number>;

interface FieldSpec {
  path: Path;
  label: string;
  limit: number;
  multiline?: boolean;
  image?: boolean;
  half?: boolean;
  hint?: string;
}

interface Group {
  title?: string;
  fields: FieldSpec[];
  remove?: { label: string; disabled: boolean; onRemove: () => void };
}

interface Section {
  id: string;
  title: string;
  blurb: string;
  note?: string;
  groups: Group[];
  add?: { label: string; disabled: boolean; onAdd: () => void };
}

const L = HOMEPAGE_LIMITS;

const field = (
  path: Path,
  label: string,
  limit: number,
  options: Partial<Omit<FieldSpec, "path" | "label" | "limit">> = {},
): FieldSpec => ({ path, label, limit, ...options });

const image = (path: Path, label: string, hint: string): FieldSpec =>
  field(path, label, 1000, { image: true, hint });

function buildSections(
  content: HomepageContent,
  actions: { addQuote: () => void; removeQuote: (index: number) => void },
): Section[] {
  const levelNames = ["Rookie", "Starter", "Pro"];
  return [
    {
      id: "hero",
      title: "Top of the page",
      blurb: "The big headline, introduction and buttons visitors see first.",
      groups: [
        {
          fields: [
            field(["hero", "eyebrow"], "Small heading above the headline", L.label, { half: true }),
            field(["hero", "title"], "Headline, first line", L.heading),
            field(["hero", "title_highlight"], "Headline, highlighted line", L.heading, {
              hint: "Shown in gold italics under the first line.",
            }),
            field(["hero", "description"], "Introduction", L.paragraph, { multiline: true }),
            field(["hero", "primary_cta"], "Main button", L.label, { half: true }),
            field(["hero", "secondary_cta"], "Second button", L.label, { half: true }),
            field(["hero", "footnote"], "Small print under the buttons", L.paragraph, {
              multiline: true,
            }),
            image(
              ["hero", "image_url"],
              "Background picture",
              "Optional web address of a picture. Leave blank to keep the built-in photo.",
            ),
          ],
        },
      ],
    },
    {
      id: "journey",
      title: "How it works",
      blurb: "The three-step “Your play journey” cards.",
      groups: [
        {
          fields: [
            field(["journey", "eyebrow"], "Small heading", L.label, { half: true }),
            field(["journey", "title"], "Section title", L.heading, { half: true }),
          ],
        },
        ...content.journey.steps.map((_, index): Group => ({
          title: `Step ${index + 1}`,
          fields: [
            field(["journey", "steps", index, "title"], "Title", L.label),
            field(["journey", "steps", index, "body"], "Description", L.paragraph, {
              multiline: true,
            }),
            image(
              ["journey", "steps", index, "image_url"],
              "Picture",
              "Optional. Leave blank to keep the built-in picture.",
            ),
          ],
        })),
      ],
    },
    {
      id: "skills",
      title: "Skill areas",
      blurb: "The dark block introducing the skill areas.",
      note: "The skill-area cards themselves come from the Play Plan catalogue. Change those in the Plans library.",
      groups: [
        {
          fields: [
            field(["skills", "title"], "Title", L.heading),
            field(["skills", "description"], "Description", L.paragraph, { multiline: true }),
            field(["skills", "button_label"], "Main button", L.label, { half: true }),
            field(["skills", "all_plans_label"], "“View all” link", L.label, { half: true }),
          ],
        },
      ],
    },
    {
      id: "week",
      title: "The Play Plan week",
      blurb: "The photo banner, the four week steps and the four headline numbers.",
      groups: [
        {
          fields: [
            field(["week", "eyebrow"], "Small heading", L.label, { half: true }),
            field(["week", "button_label"], "Button", L.label, { half: true }),
            field(["week", "title"], "Heading, first part", L.heading),
            field(["week", "title_highlight"], "Heading, highlighted part", L.heading, {
              hint: "Shown in gold italics after the first part.",
            }),
            field(["week", "description"], "Description", L.paragraph, { multiline: true }),
            image(
              ["week", "image_url"],
              "Banner picture",
              "Optional. Leave blank to keep the built-in photo.",
            ),
          ],
        },
        ...content.week.steps.map((_, index): Group => ({
          title: `Week step ${index + 1}`,
          fields: [
            field(["week", "steps", index, "when"], "When", L.label, { half: true }),
            field(["week", "steps", index, "title"], "Title", L.label, { half: true }),
            field(["week", "steps", index, "body"], "Description", L.paragraph, {
              multiline: true,
            }),
          ],
        })),
        ...content.week.stats.map((_, index): Group => ({
          title: `Number ${index + 1}`,
          fields: [
            field(["week", "stats", index, "value"], "Figure", L.stat, {
              half: true,
              hint: "Keep it short, like 5 or 1.",
            }),
            field(["week", "stats", index, "label"], "What it counts", L.label, { half: true }),
          ],
        })),
      ],
    },
    {
      id: "levels",
      title: "Levels",
      blurb: "The guidance line and the Rookie, Starter and Pro descriptions.",
      groups: [
        {
          fields: [
            field(["levels", "eyebrow"], "Small heading", L.label, { half: true }),
            field(["levels", "title"], "Guidance line", L.heading, { multiline: true }),
            ...levelNames.map((name, index) =>
              field(["levels", "descriptions", index], `${name} description`, L.paragraph, {
                multiline: true,
              }),
            ),
          ],
        },
      ],
    },
    {
      id: "stories",
      title: "Stories",
      blurb: "What families and therapists say. The second story is shown highlighted.",
      groups: [
        {
          fields: [
            field(["stories", "title"], "Section title", L.heading, { half: true }),
            field(["stories", "subtitle"], "Sub-title", L.paragraph, { half: true }),
          ],
        },
        ...content.stories.quotes.map((_, index): Group => ({
          title: `Story ${index + 1}`,
          fields: [
            field(["stories", "quotes", index, "quote"], "What they said", L.quote, {
              multiline: true,
            }),
            field(["stories", "quotes", index, "name"], "Name", L.label, { half: true }),
            field(["stories", "quotes", index, "role"], "Who they are", L.label, { half: true }),
          ],
          remove: {
            label: `Remove story ${index + 1}`,
            disabled: content.stories.quotes.length <= 1,
            onRemove: () => actions.removeQuote(index),
          },
        })),
      ],
      add: {
        label: "Add a story",
        disabled: content.stories.quotes.length >= MAX_QUOTES,
        onAdd: actions.addQuote,
      },
    },
    {
      id: "audiences",
      title: "Families and schools",
      blurb: "The two “ways in” cards near the bottom of the page.",
      groups: [
        {
          title: "Families card",
          fields: [
            field(["families", "title"], "Title", L.heading, { half: true }),
            field(["families", "button_label"], "Button", L.label, { half: true }),
            field(["families", "body"], "Description", L.paragraph, { multiline: true }),
          ],
        },
        {
          title: "Schools & clinics card",
          fields: [
            field(["schools", "title"], "Title", L.heading, { half: true }),
            field(["schools", "button_label"], "Button", L.label, { half: true }),
            field(["schools", "body"], "Description", L.paragraph, { multiline: true }),
          ],
        },
      ],
    },
    {
      id: "footer",
      title: "Footer",
      blurb: "The call to action and the small print at the very bottom.",
      groups: [
        {
          fields: [
            field(["footer", "title"], "Call-to-action title", L.heading),
            field(["footer", "description"], "Call-to-action text", L.paragraph, {
              multiline: true,
            }),
            field(["footer", "button_label"], "Button", L.label, { half: true }),
            field(["footer", "copyright"], "Copyright line", L.label, {
              half: true,
              hint: "The year is added for you.",
            }),
            field(["footer", "blurb"], "Short description under the logo", L.paragraph, {
              multiline: true,
            }),
          ],
        },
      ],
    },
  ];
}

/* ---------- reading, writing and checking values ---------- */

function getAt(content: HomepageContent, path: Path): string {
  let cursor: unknown = content;
  for (const key of path) cursor = (cursor as Record<string | number, unknown>)[key];
  return typeof cursor === "string" ? cursor : "";
}

function setAt(content: HomepageContent, path: Path, value: string): HomepageContent {
  const next = structuredClone(content) as unknown as Record<string | number, unknown>;
  let cursor = next;
  for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<string | number, unknown>;
  cursor[path[path.length - 1]!] = value;
  return next as unknown as HomepageContent;
}

const pathKey = (path: Path) => path.join(".");

/** Mirrors the API's rules so mistakes show up as you type instead of after saving. */
function fieldError(spec: FieldSpec, value: string): string | null {
  const trimmed = value.trim();
  if (spec.image) {
    if (trimmed === "") return null;
    if (/\s/.test(trimmed)) return "The address must not contain spaces.";
    if (!/^https?:\/\//i.test(trimmed) && !(trimmed.startsWith("/") && !trimmed.startsWith("//"))) {
      return "Start with https:// (or http://), or with / for a picture on this site.";
    }
  } else if (trimmed === "") {
    return "This can't be empty.";
  }
  if (value.length > spec.limit) return `Shorten this by ${value.length - spec.limit}.`;
  return null;
}

const CONTROL =
  "mt-1.5 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm text-navy outline-none transition focus:ring-2";

function FieldControl({
  spec,
  value,
  error,
  onChange,
  onUploaded,
}: {
  spec: FieldSpec;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onUploaded?: (url: string) => void;
}) {
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      onUploaded?.(await uploadHomepageImage(file));
    } catch (failure) {
      setUploadError(failure instanceof Error ? failure.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  const hintId = `${id}-hint`;
  const describedBy = [error ? `${id}-error` : null, spec.hint ? hintId : null]
    .filter(Boolean)
    .join(" ");
  const shared = {
    id,
    value,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
    className: cn(
      CONTROL,
      error
        ? "border-coral focus:border-coral focus:ring-coral/20"
        : "border-navy/15 focus:border-blue focus:ring-blue/25",
    ),
  } as const;

  return (
    <div className={cn(!spec.half && "sm:col-span-2")}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-bold text-navy">
          {spec.label}
        </label>
        {!spec.image && (
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              value.length > spec.limit ? "text-coral" : "text-navy/45",
            )}
          >
            {value.length}/{spec.limit}
          </span>
        )}
      </div>
      {spec.multiline ? (
        <textarea
          {...shared}
          rows={spec.limit > 300 ? 4 : 2}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...shared}
          type={spec.image ? "url" : "text"}
          placeholder={spec.image ? "https://…" : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {spec.image && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-navy/15 bg-card px-3 py-1.5 text-xs font-bold text-navy hover:bg-navy/5 focus-within:ring-2 focus-within:ring-blue/25">
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {uploading ? "Uploading…" : "Upload a picture"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploading}
              aria-label={`Upload a picture for ${spec.label}`}
              onChange={(event) => {
                void pick(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <span className="text-[11px] text-navy/50">JPG, PNG or WebP, up to 10 MB</span>
          {value && (
            <img
              src={apiAssetUrl(value)}
              alt=""
              className="h-10 w-16 rounded-md border border-navy/10 object-cover"
            />
          )}
        </div>
      )}
      {uploadError && (
        <p role="alert" className="mt-1 text-xs font-semibold text-coral">
          {uploadError}
        </p>
      )}
      {spec.hint && (
        <p id={hintId} className="mt-1 text-[11px] text-navy/50">
          {spec.hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- the screen ---------- */

function HomepageEditor() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: HOMEPAGE_QUERY_KEY, queryFn: loadHomepage });
  const saved = query.data;
  // `edits` only exists while there is something unsaved; until then the saved copy is shown.
  const [edits, setEdits] = useState<HomepageContent | null>(null);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(["hero"]));
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const draft = edits ?? saved?.content ?? null;
  const dirty = edits !== null && JSON.stringify(edits) !== JSON.stringify(saved?.content);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const sections = useMemo(
    () =>
      draft
        ? buildSections(draft, {
            addQuote: () =>
              setEdits((current) => {
                const base = current ?? draft;
                return {
                  ...base,
                  stories: {
                    ...base.stories,
                    quotes: [...base.stories.quotes, { quote: "", name: "", role: "" }],
                  },
                };
              }),
            removeQuote: (index) =>
              setEdits((current) => {
                const base = current ?? draft;
                return {
                  ...base,
                  stories: {
                    ...base.stories,
                    quotes: base.stories.quotes.filter((_, at) => at !== index),
                  },
                };
              }),
          })
        : [],
    [draft],
  );

  const errors = useMemo(() => {
    const found = new Map<string, string>();
    if (!draft) return found;
    for (const section of sections) {
      for (const group of section.groups) {
        for (const spec of group.fields) {
          const message = fieldError(spec, getAt(draft, spec.path));
          if (message) found.set(pathKey(spec.path), message);
        }
      }
    }
    return found;
  }, [draft, sections]);

  const errorsIn = (section: Section) =>
    section.groups.reduce(
      (count, group) =>
        count + group.fields.filter((spec) => errors.has(pathKey(spec.path))).length,
      0,
    );

  const save = useMutation({
    mutationFn: (content: HomepageContent) => saveHomepage(content),
    onSuccess: (state: HomepageState) => {
      queryClient.setQueryData(HOMEPAGE_QUERY_KEY, state);
      setEdits(null);
      setNotice({ kind: "ok", text: "Saved. The home page now shows your changes." });
    },
    onError: (error: Error) => setNotice({ kind: "error", text: error.message }),
  });

  const reset = useMutation({
    mutationFn: resetHomepage,
    onSuccess: () => {
      queryClient.setQueryData<HomepageState>(HOMEPAGE_QUERY_KEY, {
        content: DEFAULT_HOMEPAGE_CONTENT,
        customised: false,
        updatedAt: null,
      });
      setEdits(null);
      setConfirmReset(false);
      setNotice({ kind: "ok", text: "The home page is back to its original wording." });
    },
    onError: (error: Error) => {
      setConfirmReset(false);
      setNotice({ kind: "error", text: error.message });
    },
  });

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOpen = sections.length > 0 && sections.every((section) => open.has(section.id));

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Home page"
        description="Edit the words on the public home page. Nothing changes for visitors until you save."
        actions={
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View home page
          </a>
        }
      />

      {query.isLoading || !draft ? (
        <div className="ph-card mt-5 p-5">
          {query.isError ? (
            <p role="alert" className="text-sm font-semibold text-coral">
              {query.error.message}
            </p>
          ) : (
            <CardSkeleton lines={8} />
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-navy/65">
              {saved?.customised
                ? `Showing your saved wording${saved.updatedAt ? ` · last saved ${fmtDateTime(saved.updatedAt)}` : ""}.`
                : "Showing the original wording. Edit anything below to make it your own."}
            </p>
            <button
              type="button"
              onClick={() =>
                setOpen(allOpen ? new Set() : new Set(sections.map((section) => section.id)))
              }
              className="text-xs font-bold text-blue hover:underline"
            >
              {allOpen ? "Collapse all sections" : "Expand all sections"}
            </button>
          </div>

          {sections.map((section) => {
            const isOpen = open.has(section.id);
            const problems = errorsIn(section);
            const panelId = `home-section-${section.id}`;
            return (
              <section key={section.id} className="ph-card overflow-hidden">
                <h2>
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4 text-left transition hover:bg-navy/[0.02]"
                  >
                    <span className="min-w-0">
                      <span className="block text-lg font-bold">{section.title}</span>
                      <span className="block text-xs font-normal text-navy/60">
                        {section.blurb}
                      </span>
                    </span>
                    {problems > 0 && (
                      <span className="rounded-full bg-coral/12 px-2.5 py-1 text-[11px] font-bold text-coral">
                        {problems} to fix
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-navy/55 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                </h2>

                <div id={panelId} hidden={!isOpen} className="border-t border-navy/8 p-5">
                  {section.note && (
                    <p className="mb-4 rounded-xl bg-blue/8 px-4 py-3 text-xs text-navy/75">
                      {section.note}{" "}
                      <Link to="/admin/plans" className="font-bold text-blue hover:underline">
                        Open Plans library
                      </Link>
                    </p>
                  )}
                  <div className="space-y-5">
                    {section.groups.map((group, index) => (
                      <fieldset
                        key={group.title ?? index}
                        className={cn(
                          group.title && "rounded-2xl border border-navy/10 bg-navy/[0.02] p-4",
                        )}
                      >
                        {group.title && (
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <legend className="float-left text-sm font-bold">{group.title}</legend>
                            {group.remove && (
                              <button
                                type="button"
                                onClick={group.remove.onRemove}
                                disabled={group.remove.disabled}
                                aria-label={group.remove.label}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-coral hover:underline disabled:cursor-not-allowed disabled:text-navy/30 disabled:no-underline"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                Remove
                              </button>
                            )}
                          </div>
                        )}
                        <div className="grid clear-both gap-4 sm:grid-cols-2">
                          {group.fields.map((spec) => (
                            <FieldControl
                              key={pathKey(spec.path)}
                              spec={spec}
                              value={getAt(draft, spec.path)}
                              error={errors.get(pathKey(spec.path)) ?? null}
                              onChange={(value) => {
                                setNotice(null);
                                setEdits(setAt(draft, spec.path, value));
                              }}
                              onUploaded={(url) => {
                                setNotice(null);
                                setEdits((current) => setAt(current ?? draft, spec.path, url));
                              }}
                            />
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  {section.add && (
                    <button
                      type="button"
                      onClick={section.add.onAdd}
                      disabled={section.add.disabled}
                      className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      {section.add.label}
                      {section.add.disabled && ` (up to ${MAX_QUOTES})`}
                    </button>
                  )}
                </div>
              </section>
            );
          })}

          <div className="ph-card sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 shadow-(--shadow-lift)">
            <div className="min-w-0 text-sm" role="status" aria-live="polite">
              {notice ? (
                <span
                  className={cn("font-semibold", notice.kind === "ok" ? "text-blue" : "text-coral")}
                >
                  {notice.text}
                </span>
              ) : errors.size > 0 ? (
                <span className="font-semibold text-coral">
                  {errors.size} field{errors.size === 1 ? "" : "s"} need attention before you can
                  save.
                </span>
              ) : dirty ? (
                <span className="font-semibold text-navy">You have unsaved changes.</span>
              ) : (
                <span className="text-navy/55">Everything is saved.</span>
              )}
            </div>

            {confirmReset ? (
              <div
                className="flex flex-wrap items-center gap-2"
                role="alertdialog"
                aria-label="Confirm reset"
              >
                <span className="text-xs font-semibold text-navy/70">
                  Replace your saved wording with the original?
                </span>
                <button
                  type="button"
                  onClick={() => reset.mutate()}
                  disabled={reset.isPending}
                  className="inline-flex min-h-10 items-center rounded-full bg-coral px-4 text-xs font-bold text-white disabled:opacity-60"
                >
                  {reset.isPending ? "Resetting…" : "Yes, reset"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="inline-flex min-h-10 items-center rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {saved?.customised && !dirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setConfirmReset(true);
                    }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Reset to original wording
                  </button>
                )}
                {dirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setEdits(null);
                      setNotice(null);
                    }}
                    className="inline-flex min-h-10 items-center rounded-full border-2 border-navy/15 px-4 text-xs font-bold hover:border-navy/40"
                  >
                    Discard changes
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (draft && errors.size === 0) save.mutate(draft);
                  }}
                  disabled={!dirty || errors.size > 0 || save.isPending}
                  className="inline-flex min-h-10 items-center rounded-full bg-navy px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {save.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
