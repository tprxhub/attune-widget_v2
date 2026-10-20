import { useState, type CSSProperties } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  Clock9,
  FolderClosed,
  HeartHandshake,
  Layers,
  LayoutGrid,
  Minus,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Attempt, Child, Level, PlayPlan, Session } from "@/lib/types";
import { listSupporters } from "@/api/org";
import { fmtDate } from "@/lib/format";
import { AttuneMascot } from "@/features/attune/AttuneAvatar";
import { HubAppIcon, HubCardHeader } from "./HubAppIcon";
import { HubPlanMenu } from "./HubPlanMenu";
import {
  hubCardKind,
  hubLaunchItemId,
  type HubCardSetting,
  type HubTileKind,
  type HubTileOption,
  type LaunchItem,
} from "./hubTiles";

export interface HubCardContext {
  apps: LaunchItem[];
  customizing: boolean;
  plans: { items: PlayPlan[]; loading: boolean; to: string };
  checkIns: { items: Attempt[]; loading: boolean; names: Map<string, string>; canLog: boolean };
  progressPath: string;
  options: HubTileOption[];
  session: Session;
  children: Child[];
  childrenLoading: boolean;
}
interface CardContentProps {
  card: HubCardSetting;
  context: HubCardContext;
  onHideApp: (to: string) => void;
}
function HubPlansContent({ card, context }: CardContentProps) {
  const [level, setLevel] = useState<Level | "all">("all");
  const plans = context.plans.items
    .filter((plan) => level === "all" || plan.level === level)
    .slice(0, 6);
  const rows = Math.max(1, Math.ceil(plans.length / 2));
  return (
    <>
      <HubCardHeader
        title={card.title}
        subtitle="Activities"
        subtitleIcon={Clock9}
        icon={FolderClosed}
        accent="from-sky-300 to-blue-500"
      />
      <div
        className="hub-plan-list"
        data-empty={!plans.length}
        style={{ "--hub-plan-rows": rows } as CSSProperties}
      >
        {plans.map((plan, index) => (
          <Link
            key={plan.id}
            to="/plans/$planId"
            params={{ planId: plan.id }}
            className="hub-plan-row"
            data-column-end={index === rows - 1 || index === plans.length - 1}
          >
            <svg className="hub-plan-document" aria-hidden viewBox="0 0 18 24" fill="none">
              <path
                fill="currentColor"
                d="M4 1h6l6 6v14a2 2 0 0 1-2 2H4a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3Z"
              />
              <path d="M10 1v6h6" stroke="#030c25" strokeWidth="1.3" strokeLinejoin="round" />
              <text x="3.2" y="19" fill="#030c25" fontSize="3.5" fontWeight="800">
                PLAN
              </text>
            </svg>
            <span>
              <strong>{plan.title}</strong>
              <small className="capitalize">
                {plan.level} dose · {plan.entries.length} activities
              </small>
            </span>
          </Link>
        ))}
        {!plans.length && (
          <p className="hub-plan-empty">
            {context.plans.loading
              ? "Loading Play Plans…"
              : level === "all"
                ? "Play Plans will appear here."
                : "No Play Plans for this dose yet."}
          </p>
        )}
      </div>
      <HubPlanMenu
        title={card.title}
        value={level}
        onChange={setLevel}
        to={context.plans.to as never}
      />
    </>
  );
}

function HubAppsContent({ card, context, onHideApp }: CardContentProps) {
  return (
    <>
      <h2 className="hub-apps-heading">
        <Layers aria-hidden />
        {card.title}
      </h2>
      <ul className="hub-app-list">
        {context.apps.map((item) => (
          <li key={hubLaunchItemId(item)} className="relative min-w-0">
            <Link to={item.to as never} className="hub-app-link">
              <HubAppIcon icon={item.icon} accent={item.accent} />
              <span>{item.label}</span>
            </Link>
            {context.customizing && (
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() => onHideApp(hubLaunchItemId(item))}
                className="hub-app-remove"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function HubProgressContent({ card, context }: CardContentProps) {
  return (
    <>
      <HubCardHeader
        title={card.title}
        subtitle="Recent activity"
        icon={BarChart3}
        accent="from-emerald-300 to-teal-500"
      />
      <div className="hub-progress-list">
        {[
          ["Session history", CalendarCheck],
          ["Support score", HeartHandshake],
          ["Skill milestones", Sparkles],
        ].map(([label, Icon]) => {
          const RowIcon = Icon as LucideIcon;
          return (
            <Link
              key={label as string}
              to={context.progressPath as never}
              className="hub-progress-row"
            >
              <RowIcon aria-hidden />
              <span>{label as string}</span>
              <ArrowRight aria-hidden />
            </Link>
          );
        })}
      </div>
      <Link to={context.progressPath as never} className="hub-card-footer">
        View progress <ArrowRight aria-hidden />
      </Link>
    </>
  );
}

function HubCheckInsContent({ card, context }: CardContentProps) {
  return (
    <>
      <HubCardHeader
        title={card.title}
        subtitle="Recent check-ins"
        icon={CalendarCheck}
        accent="from-amber-300 to-orange-400"
      />
      <div className="hub-checkin-list">
        {context.checkIns.items.map((attempt) => (
          <div key={attempt.id} className="hub-checkin-row">
            <Check aria-hidden />
            <div className="min-w-0 flex-1">
              <p>
                {context.checkIns.names.get(attempt.childId) ?? "Member"} · {attempt.activity}
              </p>
              <small>{fmtDate(attempt.date)}</small>
            </div>
          </div>
        ))}
        {!context.checkIns.loading && !context.checkIns.items.length && (
          <p className="py-5 text-sm text-white/55">No check-ins yet.</p>
        )}
        {context.checkIns.loading && (
          <p className="py-5 text-sm text-white/55">Loading recent check-ins…</p>
        )}
      </div>
      <div className="hub-card-footer hub-checkin-footer">
        <Link to={context.checkIns.canLog ? "/check-in" : (context.progressPath as never)}>
          {context.checkIns.canLog ? "Log a check-in" : "View check-ins"}
        </Link>
        <Link to={context.progressPath as never}>
          Progress <ArrowRight aria-hidden />
        </Link>
      </div>
    </>
  );
}

function HubAttuneContent({ card, context }: CardContentProps) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");

  function ask(questionText: string) {
    const q = questionText.trim();
    if (q && !context.customizing) void navigate({ to: "/attune", search: { q } });
  }

  return (
    <>
      <HubCardHeader
        title={card.title}
        subtitle="Your next step"
        icon={Sparkles}
        accent="from-pink-300 to-rose-500"
      />
      <div className="hub-attune-content">
        <Link to="/attune" className="hub-attune-link">
          <span>
            Get support for your member <ArrowRight className="mt-3 h-5 w-5" aria-hidden />
          </span>
        </Link>
        <div className="hub-attune-wide">
          <p>What would you like help with?</p>
          <form
            className="hub-attune-search"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <label className="sr-only" htmlFor={`hub-attune-question-${card.id}`}>
              Your question for Attune
            </label>
            <input
              id={`hub-attune-question-${card.id}`}
              type="search"
              value={question}
              maxLength={500}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about your member's play…"
              disabled={context.customizing}
            />
            <button
              type="submit"
              aria-label="Ask Attune"
              disabled={!question.trim() || context.customizing}
            >
              <ArrowRight aria-hidden />
            </button>
          </form>
          <div className="hub-attune-prompts" aria-label="Try a question">
            <button
              type="button"
              disabled={context.customizing}
              onClick={() => ask("Give me one play idea for my member today.")}
            >
              Play idea
            </button>
            <button
              type="button"
              disabled={context.customizing}
              onClick={() => ask("What can I do when my member is having a hard moment?")}
            >
              Hard moment
            </button>
          </div>
        </div>
        <AttuneMascot className="hub-attune-mascot" />
      </div>
    </>
  );
}
function HubShortcutContent({ card, context }: CardContentProps) {
  const option =
    context.options.find(
      (item) => item.kind === "shortcut" && item.to === card.to && item.title === card.title,
    ) ?? context.options.find((item) => item.to === card.to);
  return (
    <>
      <HubCardHeader
        title={card.title}
        subtitle={card.detail ?? option?.detail ?? "Your Play Hub space"}
        icon={option?.icon ?? LayoutGrid}
        accent={option?.accent ?? "from-sky-300 to-blue-500"}
      />
      {card.to === "/org/supporters" && context.session.role === "educator" ? (
        <HubModeratorsSummary session={context.session} />
      ) : card.to === "/dashboard" && card.title === "Dashboard" ? (
        <HubDashboardSummary context={context} />
      ) : card.to === "/org" && context.session.accountType === "b2b" ? (
        <HubMembersSummary context={context} />
      ) : null}
      <Link to={(card.to ?? "/dashboard") as never} className="hub-card-footer">
        Open {card.title}
        <ArrowRight aria-hidden />
      </Link>
    </>
  );
}

function HubSummaryRow({
  icon: Icon,
  name,
  detail,
}: {
  icon: LucideIcon;
  name: string;
  detail: string;
}) {
  return (
    <div className="hub-shortcut-row">
      <span className="hub-shortcut-row-icon">
        <Icon aria-hidden />
      </span>
      <span className="min-w-0">
        <strong>{name}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function HubModeratorsSummary({ session }: { session: Session }) {
  const supporters = useQuery({
    queryKey: ["supporters", session.orgId],
    queryFn: () => listSupporters(session.orgId),
    enabled: !!session.orgId,
  });
  const list = supporters.data ?? [];
  return (
    <div className="hub-shortcut-list" aria-label="Moderator information">
      {supporters.isLoading ? (
        <p className="text-sm text-white/55">Loading moderators…</p>
      ) : supporters.isError ? (
        <p className="text-sm text-white/55">Moderator information is unavailable.</p>
      ) : list.length ? (
        list
          .slice(0, 3)
          .map((person) => (
            <HubSummaryRow
              key={person.id}
              icon={HeartHandshake}
              name={person.name}
              detail={
                person.invitationPending
                  ? "Invitation pending"
                  : !person.active
                    ? "Disabled"
                    : `${person.childCount} ${person.childCount === 1 ? "member" : "members"} assigned`
              }
            />
          ))
      ) : (
        <p className="text-sm text-white/55">No moderators added yet.</p>
      )}
      {list.length > 3 && (
        <small className="pt-2 text-white/55">+{list.length - 3} more moderators</small>
      )}
    </div>
  );
}

function HubMembersSummary({ context }: { context: HubCardContext }) {
  return (
    <div className="hub-shortcut-list" aria-label="Member information">
      {context.childrenLoading ? (
        <p className="text-sm text-white/55">Loading members…</p>
      ) : context.children.length ? (
        context.children
          .slice(0, 3)
          .map((child) => (
            <HubSummaryRow
              key={child.id}
              icon={Users}
              name={child.name}
              detail={`${child.age} years · ${context.plans.items.find((plan) => plan.id === child.currentPlanId)?.title ?? "Play Plan pending"}`}
            />
          ))
      ) : (
        <p className="text-sm text-white/55">No members enrolled yet.</p>
      )}
      {context.children.length > 3 && (
        <small className="pt-2 text-white/55">+{context.children.length - 3} more members</small>
      )}
    </div>
  );
}

function HubDashboardSummary({ context }: { context: HubCardContext }) {
  const count = context.children.length;
  const recent = context.checkIns.items.length;
  return (
    <div className="hub-shortcut-list" aria-label="Dashboard summary">
      {context.childrenLoading ? (
        <p className="text-sm text-white/55">Loading your summary…</p>
      ) : (
        <>
          <HubSummaryRow
            icon={Users}
            name={`${count} ${count === 1 ? "member" : "members"}`}
            detail={count ? "In your Play Hub" : "Add a member to get started"}
          />
          <HubSummaryRow
            icon={CalendarCheck}
            name={`${recent} recent ${recent === 1 ? "check-in" : "check-ins"}`}
            detail={recent ? "Latest activity" : "Log a session to see activity"}
          />
          {count > 0 && (
            <HubSummaryRow
              icon={FolderClosed}
              name={context.children[0]!.name}
              detail={
                context.plans.items.find((plan) => plan.id === context.children[0]!.currentPlanId)
                  ?.title ?? "View Play Plan"
              }
            />
          )}
        </>
      )}
    </div>
  );
}
const CONTENTS: Record<HubTileKind, (props: CardContentProps) => React.ReactNode> = {
  plans: HubPlansContent,
  apps: HubAppsContent,
  progress: HubProgressContent,
  "check-ins": HubCheckInsContent,
  attune: HubAttuneContent,
  shortcut: HubShortcutContent,
};
export function HubCardContent(props: CardContentProps) {
  const Content = CONTENTS[hubCardKind(props.card)] ?? HubShortcutContent;
  return <Content {...props} />;
}
