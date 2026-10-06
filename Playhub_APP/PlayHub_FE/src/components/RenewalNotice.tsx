import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, X } from "lucide-react";
import { daysLeftLabel, getSubscriptions, subscriptionStage } from "@/api/subscriptions";
import { useSession } from "@/auth/session";
import { useActiveChild } from "@/lib/active-child";
import { fmtDate } from "@/lib/format";

/** Ended subscriptions keep a gentle reminder for this many days, then it goes quiet. */
const ENDED_REMINDER_DAYS = 30;

function storageKey(childId: string, lastDay: string, stage: string) {
  return `playhub:renewal-dismissed:${childId}:${lastDay}:${stage}`;
}

function wasDismissed(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * A soft, dismissible reminder for family accounts: shown during the last days of a
 * subscription and for a while after it ends. Dismissing hides it for that child until the
 * next stage (e.g. "ending" → "ended") or a new last day.
 */
export function RenewalNotice() {
  const { session } = useSession();
  const { children, setActiveChildId } = useActiveChild();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const isFamily = session.role === "parent" && session.accountType === "b2c";
  const ids = children.map((child) => child.id);
  const subs = useQuery({
    queryKey: ["subs", ids.join(",")],
    queryFn: () => getSubscriptions(ids),
    enabled: isFamily && ids.length > 0,
  });

  if (!isFamily || pathname.startsWith("/subscription")) return null;

  const notices = (subs.data ?? []).flatMap((sub) => {
    const child = children.find((c) => c.id === sub.childId);
    const { stage, lastDay, daysLeft } = subscriptionStage(sub);
    if (!child || !lastDay || daysLeft === null) return [];
    if (stage !== "ending" && !(stage === "ended" && -daysLeft <= ENDED_REMINDER_DAYS)) return [];
    const key = storageKey(child.id, lastDay, stage);
    if (dismissed.includes(key) || wasDismissed(key)) return [];
    return [{ child, stage, lastDay, daysLeft, key }];
  });

  if (notices.length === 0) return null;

  const dismiss = (key: string) => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Private mode: it still hides for this visit.
    }
    setDismissed((current) => [...current, key]);
  };

  return (
    <div className="mb-5 grid gap-2">
      {notices.map(({ child, stage, lastDay, daysLeft, key }) => (
        <aside
          key={key}
          role="status"
          aria-label={`Subscription reminder for ${child.name}`}
          className="flex items-start gap-3 rounded-2xl border border-amber/50 bg-amber/12 px-4 py-3 text-sm"
        >
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-navy/70" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {stage === "ending"
                ? `${child.name}’s subscription ends ${daysLeftLabel(daysLeft)}`
                : `${child.name}’s subscription has ended`}
            </p>
            <p className="mt-0.5 text-navy/70">
              {stage === "ending"
                ? `Last day: ${fmtDate(lastDay)}. Renew now to keep logging Sessions — the new plan starts the day after, so no days are lost.`
                : `It ended on ${fmtDate(lastDay)}. Re-subscribe any time to pick up where you left off — every Session is still saved.`}
            </p>
            <Link
              to="/subscription"
              search={{ checkout: undefined }}
              onClick={() => setActiveChildId(child.id)}
              className="mt-2 inline-flex min-h-9 items-center rounded-full bg-navy px-4 text-xs font-bold text-cream hover:bg-blue"
            >
              {stage === "ending" ? "Renew subscription" : "Re-subscribe"}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => dismiss(key)}
            aria-label="Dismiss reminder"
            className="-m-1 rounded-full p-1.5 text-navy/50 hover:bg-navy/8 hover:text-navy"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </aside>
      ))}
    </div>
  );
}
