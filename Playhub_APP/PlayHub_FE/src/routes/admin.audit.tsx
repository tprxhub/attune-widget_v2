import { useMemo, useState, type ComponentType } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Building2,
  Download,
  Loader2,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  CreditCard,
  FilePenLine,
  History,
  Search,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { getAuditLog, type AuditEvent, type AuditLogData } from "@/api/audit";
import { Protected } from "@/auth/guards";
import { useSession } from "@/auth/session";
import { allowedAuditCategories } from "@/lib/roles";
import { PageHeader } from "@/components/AppShell";
import { CardSkeleton } from "@/components/Skeletons";
import { ACTION_TITLES } from "@/lib/audit-labels";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, fmtLongDate, fmtTime } from "@/lib/format";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log — Play Hub admin" }] }),
  component: () => (
    <Protected roles={["super_admin", "ttp_employee"]} permission="audit">
      <AuditPage />
    </Protected>
  ),
});

type AuditCategory = "activity" | "accounts" | "content" | "billing" | "organisation" | "system";

const CATEGORY_META: Record<
  AuditCategory,
  {
    label: string;
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    styles: string;
  }
> = {
  activity: { label: "Check-ins", icon: Activity, styles: "bg-blue/10 text-blue" },
  accounts: { label: "Accounts", icon: UserCog, styles: "bg-navy/8 text-navy" },
  content: { label: "Play content", icon: FilePenLine, styles: "bg-amber/25 text-navy" },
  billing: { label: "Billing", icon: CreditCard, styles: "bg-coral/10 text-coral" },
  organisation: { label: "Organisations", icon: Building2, styles: "bg-blue/10 text-blue" },
  system: { label: "System", icon: ShieldCheck, styles: "bg-navy/8 text-navy" },
};


const FIELD_LABELS: Record<string, string> = {
  account_scope: "account type",
  admin_id: "assigned Admin",
  age_guidance: "age guidance",
  billing_cycle: "billing cycle",
  current_play_dose_id: "assigned Play Dose",
  date_of_birth: "date of birth",
  display_name: "display name",
  is_active: "active status",
  moderator_id: "assigned Moderator",
  name: "name",
  notes: "notes",
  organisation_id: "organisation",
  owner_id: "parent account",
  role: "role",
  seat_limit: "license limit",
  thumbnail_url: "thumbnail",
  video_url: "video",
};

function categoryFor(event: AuditEvent): AuditCategory {
  if (event.action.startsWith("attempt.")) return "activity";
  if (event.action.startsWith("billing.") || event.action.startsWith("subscription.")) {
    return "billing";
  }
  if (
    event.action.startsWith("play_") ||
    event.action.startsWith("activity.") ||
    event.action.startsWith("site_content.")
  ) {
    return "content";
  }
  if (event.action.startsWith("organisation.") || event.action.startsWith("child.")) {
    return "organisation";
  }
  if (
    event.action.startsWith("user.") ||
    event.action.startsWith("family.") ||
    event.action.startsWith("invitation.")
  ) {
    return "accounts";
  }
  return "system";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actorName(event: AuditEvent, data: AuditLogData) {
  if (!event.actor_id) return "Play Hub system";
  return (
    event.actor_name ??
    data.users.find((user) => user.id === event.actor_id)?.display_name ??
    "Former account"
  );
}

function resourceName(event: AuditEvent, data: AuditLogData) {
  const direct = event.resource_id;
  if (event.resource_type === "user") {
    return data.users.find((user) => user.id === direct)?.display_name;
  }
  if (event.resource_type === "child") {
    return data.children.find((child) => child.id === direct)?.name;
  }
  if (event.resource_type === "organisation") {
    return data.organisations.find((org) => org.id === direct)?.name;
  }
  if (event.resource_type === "play_plan") {
    return data.plans.find((plan) => plan.id === direct)?.name;
  }
  if (event.resource_type === "play_dose") {
    return data.plans.flatMap((plan) => plan.play_doses).find((dose) => dose.id === direct)?.title;
  }
  if (event.resource_type === "activity") {
    return data.plans
      .flatMap((plan) => plan.play_doses)
      .flatMap((dose) => dose.activities)
      .find((activity) => activity.id === direct)?.title;
  }
  if (event.resource_type === "site_content") return "Play Hub homepage";
  return undefined;
}

function metadataString(event: AuditEvent, key: string) {
  const value = event.metadata_json[key];
  return typeof value === "string" ? value : undefined;
}

function childFromMetadata(event: AuditEvent, data: AuditLogData) {
  const childId = metadataString(event, "child_id");
  return childId ? data.children.find((child) => child.id === childId)?.name : undefined;
}

function planFromMetadata(event: AuditEvent, data: AuditLogData) {
  const planId = metadataString(event, "play_plan_id");
  return planId ? data.plans.find((plan) => plan.id === planId)?.name : undefined;
}

function changedFields(event: AuditEvent) {
  const fields = event.metadata_json["fields"];
  return Array.isArray(fields)
    ? fields
        .filter((field): field is string => typeof field === "string")
        .map((field) => FIELD_LABELS[field] ?? humanize(field).toLowerCase())
    : [];
}

function describeEvent(event: AuditEvent, data: AuditLogData) {
  const target = resourceName(event, data);
  const child = childFromMetadata(event, data);
  const plan = planFromMetadata(event, data);
  const fields = changedFields(event);
  const role = metadataString(event, "role");

  if (event.action === "attempt.created") {
    return `A check-in was logged${child ? ` for ${child}` : ""}${plan ? ` in ${plan}` : ""}.`;
  }
  if (event.action === "invitation.created") {
    return `A new ${role ? humanize(role).toLowerCase() : "account"} invitation was created.`;
  }
  if (event.action === "invitation.accepted") {
    return "The invited person activated their account and completed sign-in setup.";
  }
  if (event.action === "invitation.activation_regenerated") {
    return `A replacement activation link was generated${role ? ` for a ${humanize(role).toLowerCase()}` : ""}.`;
  }
  if (event.action === "family.registered")
    return "A family completed registration and created a child profile.";
  if (event.action === "user.password_changed")
    return `${target ?? "A user"} changed their account password.`;
  if (event.action === "user.google_linked")
    return `${target ?? "A user"} connected Google sign-in.`;
  if (event.action.includes("avatar"))
    return `${target ?? "A user"} changed their profile appearance.`;
  if (event.action === "billing.payment_completed")
    return "The payment provider confirmed a successful subscription payment.";
  if (event.action === "billing.refund_failed")
    return "A refund could not be completed and may require manual review.";
  if (event.action.includes("refund")) return "A subscription refund status changed.";
  if (event.action === "billing.checkout_created")
    return `${child ?? "A family"} started subscription checkout.`;
  if (event.action.startsWith("site_content.")) return "The public homepage content was changed.";
  if (event.action === "developer.persona_switched")
    return "A development-only test account was selected.";
  if (event.action.endsWith(".deleted"))
    return `${target ?? humanize(event.resource_type)} was removed.`;
  if (event.action.endsWith(".created"))
    return `${target ?? humanize(event.resource_type)} was added to Play Hub.`;
  if (event.action.endsWith(".updated")) {
    return `${target ?? humanize(event.resource_type)} was updated${fields.length ? `: ${fields.join(", ")}` : ""}.`;
  }
  if (event.action.endsWith(".uploaded"))
    return `New media was uploaded for ${target ?? humanize(event.resource_type).toLowerCase()}.`;
  return `${ACTION_TITLES[event.action] ?? humanize(event.action.replace(".", " "))} was recorded by the API.`;
}

/** Writes the filtered events to an .xlsx file with readable names instead of raw IDs. */
async function exportAuditToExcel(events: AuditEvent[], data: AuditLogData, label: string) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const header = [
    "Date",
    "Time",
    "Category",
    "Event",
    "Description",
    "Performed by",
    "Resource type",
    "Resource",
    "Resource ID",
  ].map((value) => ({ value, fontWeight: "bold" as const }));
  const rows = events.map((event) => {
    const when = new Date(event.created_at);
    return [
      fmtDate(when),
      fmtTime(when, true),
      CATEGORY_META[categoryFor(event)].label,
      ACTION_TITLES[event.action] ?? humanize(event.action),
      describeEvent(event, data),
      actorName(event, data),
      humanize(event.resource_type),
      resourceName(event, data) ?? "",
      event.resource_id,
    ].map((value) => ({ value: String(value ?? ""), type: String }));
  });
  const columns = [12, 10, 16, 28, 60, 24, 16, 28, 38].map((width) => ({ width }));
  const stamp = new Date().toISOString().slice(0, 10);
  await writeExcelFile([header, ...rows], { columns, sheet: label }).toFile(
    `playhub-audit-log-${stamp}.xlsx`,
  );
}

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function dateHeading(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const key = date.toDateString();
  if (key === today.toDateString()) return "Today";
  if (key === yesterday.toDateString()) return "Yesterday";
  return fmtLongDate(date);
}

function timeLabel(value: string) {
  return fmtTime(value);
}

function AuditPage() {
  const audit = useQuery({ queryKey: ["audit-events"], queryFn: () => getAuditLog(200) });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const { session } = useSession();
  const allowedCategories = allowedAuditCategories(session).map((category) =>
    category === "organisations" ? "organisation" : category,
  );
  const restricted = session.role === "ttp_employee";
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const events = useMemo(() => audit.data?.events ?? [], [audit.data?.events]);
  const todayCount = events.filter(
    (event) => new Date(event.created_at).toDateString() === new Date().toDateString(),
  ).length;
  const accountCount = events.filter((event) => categoryFor(event) === "accounts").length;
  const warningCount = events.filter((event) => event.action.includes("failed")).length;

  const filtered = useMemo(() => {
    if (!audit.data) return [];
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      const eventCategory = categoryFor(event);
      if (category !== "all" && eventCategory !== category) return false;
      if (!needle) return true;
      const haystack = [
        ACTION_TITLES[event.action] ?? event.action,
        describeEvent(event, audit.data),
        actorName(event, audit.data),
        resourceName(event, audit.data),
        event.action,
        event.resource_type,
        event.resource_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [audit.data, category, events, query]);

  const visibleEvents = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);

  const grouped = useMemo(() => {
    const groups: Array<{ label: string; events: AuditEvent[] }> = [];
    for (const event of visibleEvents) {
      const label = dateHeading(event.created_at);
      const latest = groups.at(-1);
      if (latest?.label === label) latest.events.push(event);
      else groups.push({ label, events: [event] });
    }
    return groups;
  }, [visibleEvents]);

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Audit log"
        description="A readable, append-only history of account, content, billing and check-in changes across Play Hub."
        actions={
          <button
            type="button"
            disabled={!audit.data || filtered.length === 0 || exporting}
            onClick={async () => {
              if (!audit.data) return;
              setExporting(true);
              setExportError("");
              try {
                await exportAuditToExcel(filtered, audit.data, "Audit log");
              } catch {
                setExportError("The Excel file could not be created. Please try again.");
              } finally {
                setExporting(false);
              }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            Export to Excel
          </button>
        }
      />
      {restricted && (
        <p className="mt-3 rounded-2xl bg-navy/5 px-4 py-3 text-xs font-semibold text-navy/70">
          {allowedCategories.length === 0
            ? "A Super Admin hasn't given you access to any log types yet, so no entries are shown."
            : `You can see these log types: ${allowedCategories
                .map((category) => CATEGORY_META[category as AuditCategory].label)
                .join(", ")}. Exports include only these.`}
        </p>
      )}
      {exportError && (
        <p role="alert" className="mt-2 text-sm font-semibold text-coral">
          {exportError}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Events retained",
            value: events.length,
            icon: History,
            styles: "bg-navy text-cream",
          },
          {
            label: "Recorded today",
            value: todayCount,
            icon: CalendarDays,
            styles: "bg-blue text-white",
          },
          {
            label: "Account events",
            value: accountCount,
            icon: Users,
            styles: "bg-amber text-navy",
          },
          {
            label: "Needs attention",
            value: warningCount,
            icon: warningCount ? AlertTriangle : CircleCheck,
            styles: warningCount ? "bg-coral text-white" : "bg-card text-blue",
          },
        ].map((item) => (
          <div key={item.label} className="ph-card flex items-center gap-3 p-4">
            <span
              className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", item.styles)}
            >
              <item.icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span>
              <span className="block text-xl font-bold text-navy">{item.value}</span>
              <span className="block text-[11px] font-semibold text-navy/55">{item.label}</span>
            </span>
          </div>
        ))}
      </div>

      <section className="ph-card mt-4 overflow-hidden">
        <div className="border-b border-navy/8 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold text-navy">Activity history</p>
              <p className="mt-0.5 text-xs text-navy/55">
                Search by person, child, Play Plan or event. Select an entry for technical details.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(15rem,1fr)_12rem]">
              <label className="relative block">
                <span className="sr-only">Search audit events</span>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-navy/40"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search activity…"
                  className="min-h-11 w-full rounded-lg border border-navy/12 bg-navy/[0.025] pr-3 pl-10 text-sm font-semibold text-navy outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/15"
                />
              </label>
              <label className="block">
                <span className="sr-only">Filter by category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as AuditCategory | "all")}
                  className="min-h-11 w-full rounded-lg border border-navy/12 bg-card px-3 text-sm font-bold text-navy outline-none focus:border-blue focus:ring-2 focus:ring-blue/15"
                >
                  <option value="all">All categories</option>
                  {(
                    Object.entries(CATEGORY_META) as [
                      AuditCategory,
                      (typeof CATEGORY_META)[AuditCategory],
                    ][]
                  )
                    .filter(([value]) => allowedCategories.includes(value))
                    .map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {audit.isLoading ? (
          <div className="p-5">
            <CardSkeleton lines={6} />
          </div>
        ) : audit.isError ? (
          <p role="alert" className="p-5 text-sm font-semibold text-coral">
            {audit.error.message}
          </p>
        ) : grouped.length ? (
          <div className="p-4 sm:p-5">
            {grouped.map((group, groupIndex) => (
              <div key={group.label} className={cn(groupIndex > 0 && "mt-6")}>
                <div className="mb-3 flex items-center gap-3">
                  <p className="text-xs font-bold tracking-wide text-navy/55 uppercase">
                    {group.label}
                  </p>
                  <span className="h-px flex-1 bg-navy/8" />
                  <span className="text-[10px] font-bold text-navy/40">
                    {group.events.length} event{group.events.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.events.map((event) => {
                    const eventCategory = categoryFor(event);
                    const meta = CATEGORY_META[eventCategory];
                    const Icon = meta.icon;
                    const open = expanded === event.id;
                    const actor = actorName(event, audit.data!);
                    const target = resourceName(event, audit.data!);
                    return (
                      <li
                        key={event.id}
                        className="overflow-hidden rounded-xl border border-navy/8 bg-card"
                      >
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : event.id)}
                          aria-expanded={open}
                          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-3.5 text-left transition hover:bg-navy/[0.025] sm:p-4"
                        >
                          <span
                            className={cn(
                              "grid h-10 w-10 place-items-center rounded-lg",
                              meta.styles,
                            )}
                          >
                            <Icon className="h-4.5 w-4.5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-navy">
                                {ACTION_TITLES[event.action] ??
                                  humanize(event.action.replace(".", " "))}
                              </span>
                              <span
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-[9px] font-bold",
                                  meta.styles,
                                )}
                              >
                                {meta.label}
                              </span>
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-navy/65">
                              {describeEvent(event, audit.data!)}
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-navy/45">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-navy/8 text-[8px] font-bold text-navy">
                                  {actor.slice(0, 1).toUpperCase()}
                                </span>
                                {actor}
                              </span>
                              {target && (
                                <span className="inline-flex items-center gap-1">
                                  <ClipboardList className="h-3 w-3" aria-hidden /> {target}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 pt-0.5">
                            <time
                              className="whitespace-nowrap text-[11px] font-semibold text-navy/50"
                              dateTime={event.created_at}
                              title={fmtDateTime(event.created_at, true)}
                            >
                              {timeLabel(event.created_at)}
                            </time>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-navy/35 transition-transform",
                                open && "rotate-180",
                              )}
                              aria-hidden
                            />
                          </span>
                        </button>

                        {open && (
                          <div className="border-t border-navy/8 bg-navy/[0.025] px-4 py-3 sm:pl-[4.75rem]">
                            <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                              <div>
                                <dt className="font-bold text-navy/45">Event action</dt>
                                <dd className="mt-0.5 font-semibold text-navy">{event.action}</dd>
                              </div>
                              <div>
                                <dt className="font-bold text-navy/45">Recorded at</dt>
                                <dd className="mt-0.5 font-semibold text-navy">
                                  {fmtDateTime(event.created_at, true)}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-bold text-navy/45">Affected record</dt>
                                <dd className="mt-0.5 break-all font-semibold text-navy">
                                  {humanize(event.resource_type)} · {shortId(event.resource_id)}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-bold text-navy/45">Actor ID</dt>
                                <dd className="mt-0.5 break-all font-semibold text-navy">
                                  {event.actor_id
                                    ? shortId(event.actor_id)
                                    : "Automated system event"}
                                </dd>
                              </div>
                            </dl>
                            {Object.keys(event.metadata_json).length > 0 && (
                              <div className="mt-3 border-t border-navy/8 pt-3">
                                <p className="text-[10px] font-bold tracking-wide text-navy/45 uppercase">
                                  Recorded context
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {Object.entries(event.metadata_json).map(([key, value]) => (
                                    <span
                                      key={key}
                                      className="rounded-md bg-white px-2.5 py-1 text-[10px] font-semibold text-navy/60"
                                    >
                                      <span className="font-bold text-navy">{humanize(key)}:</span>{" "}
                                      {Array.isArray(value)
                                        ? value.map((item) => humanize(String(item))).join(", ")
                                        : String(value)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {filtered.length > visibleEvents.length && (
              <div className="mt-5 border-t border-navy/8 pt-5 text-center">
                <p className="mb-3 text-xs font-semibold text-navy/50">
                  Showing {visibleEvents.length} of {filtered.length} matching events
                </p>
                <button
                  type="button"
                  onClick={() => setVisibleLimit((current) => current + 30)}
                  className="min-h-10 rounded-lg bg-navy px-5 text-xs font-bold text-cream transition hover:bg-navy/90"
                >
                  Show more activity
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center p-6 text-center">
            <div>
              <Search className="mx-auto h-6 w-6 text-navy/30" aria-hidden />
              <p className="mt-2 text-sm font-bold text-navy">No matching audit events</p>
              <p className="mt-1 text-xs text-navy/55">Try a different search or category.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
