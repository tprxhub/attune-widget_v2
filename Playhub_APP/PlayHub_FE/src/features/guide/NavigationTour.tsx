import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Map,
  MousePointer2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useSession } from "@/auth/session";
import { ModalPortal } from "@/components/ModalPortal";
import { NAVIGATION_TOUR_EVENT, setNavigationTourChildMenu } from "./navigation-tour-events";

const COPY: Record<string, string> = {
  Dashboard: "Your daily starting point: see the next Play Dose and the latest child summary.",
  Overview:
    "See the platform at a glance. Only information you have permission to access appears here.",
  Children: "Review child profiles, assignments and the plans they are currently following.",
  "Play Plans": "Browse the available plans, choose a level and continue a child’s play journey.",
  "Daily Check-In": "Record how an activity went, including completion, support and mood.",
  Progress: "Turn completed sessions into clear trends and practical next steps.",
  Members: "Manage the children and members connected to your organisation.",
  Moderators: "Invite and manage the people supporting your organisation’s children.",
  "Audit log": "Review important account and content activity in one traceable timeline.",
  "Plans library": "Create and maintain Play Plans, Play Doses and their activities.",
  "Home page": "Update the public Play Hub page without changing application code.",
  Organisations: "Manage schools, clinics and their licences.",
  "Admins & Moderators": "Manage organisation staff and pending account invitations.",
  "TTP Employees": "Give internal team members access only to the tools they need.",
  Subscription: "Review the family plan and billing details.",
  Account: "Update your profile, password and—when available—your navigation preferences.",
};

interface TourItem {
  to: string;
  label: string;
  target?: string;
  description?: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export function NavigationTour({ items }: { items: TourItem[] }) {
  const { session } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const storageKey = `playhub:navigation-tour:${session.personaId}:v1`;
  const step = items[index];
  const goalRoute = items.some((item) => item.to === "/check-in")
    ? "/check-in"
    : items.some((item) => item.to === "/plans")
      ? "/plans"
      : items[0]?.to;
  const goalLabel =
    goalRoute === "/check-in"
      ? "Log your first session"
      : goalRoute === "/plans"
        ? "Choose a Play Dose"
        : "Open your workspace";

  const finish = useCallback(() => {
    window.localStorage.setItem(storageKey, "complete");
    setOpen(false);
    setRect(null);
  }, [storageKey]);

  const measure = useCallback(() => {
    if (!step) return setRect(null);
    const selector = step.target ? "[data-tour-target]" : "[data-tour-path]";
    const expected = step.target ?? step.to;
    const target = [...document.querySelectorAll<HTMLElement>(selector)].find((node) => {
      const value = step.target ? node.dataset["tourTarget"] : node.dataset["tourPath"];
      if (value !== expected) return false;
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    if (!target) return setRect(null);
    let box = target.getBoundingClientRect();
    if (
      box.top < 8 ||
      box.bottom > window.innerHeight - 8 ||
      box.left < 8 ||
      box.right > window.innerWidth - 8
    ) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      box = target.getBoundingClientRect();
    }
    setRect({
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
      right: box.right,
      bottom: box.bottom,
    });
  }, [step]);

  const begin = useCallback(
    (automatic: boolean) => {
      const first = items[0];
      if (!first) return;

      // Record an automatic launch before changing routes. AppShell can remount while the first
      // destination loads; writing first guarantees a new account never receives the auto-tour
      // twice. Manual launches intentionally ignore this marker.
      window.localStorage.setItem(storageKey, automatic ? "shown" : "started");
      setIndex(0);
      setRect(null);
      setOpen(true);
      if (pathname !== first.to) void navigate({ to: first.to } as never);
    },
    [items, navigate, pathname, storageKey],
  );

  useEffect(() => {
    const start = () => begin(false);
    window.addEventListener(NAVIGATION_TOUR_EVENT, start);
    const timer = window.setTimeout(() => {
      if (
        window.location.pathname === session.homePath &&
        !window.localStorage.getItem(storageKey)
      ) {
        begin(true);
      }
    }, 700);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(NAVIGATION_TOUR_EVENT, start);
    };
  }, [begin, session.homePath, storageKey]);

  useEffect(() => {
    const needsChildMenu = open && step?.target === "add-child";
    setNavigationTourChildMenu(needsChildMenu);
    return () => {
      if (needsChildMenu) setNavigationTourChildMenu(false);
    };
  }, [open, step?.target]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(measure, step?.target === "add-child" ? 180 : 80);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, pathname, index, measure, step?.target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") advance();
      if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const go = useCallback(
    (nextIndex: number) => {
      if (!items[nextIndex]) return finish();
      setIndex(nextIndex);
      setRect(null);
    },
    [finish, items],
  );
  const advance = useCallback(() => go(index + 1), [go, index]);
  const back = useCallback(() => go(Math.max(0, index - 1)), [go, index]);

  const position = useMemo(() => {
    if (!rect || typeof window === "undefined") return { left: 16, top: 100 };
    const width = Math.min(370, window.innerWidth - 32);
    if (window.innerWidth >= 1024 && rect.right < window.innerWidth / 2) {
      return {
        left: Math.min(window.innerWidth - width - 20, rect.right + 22),
        top: Math.max(20, Math.min(window.innerHeight - 360, rect.top - 24)),
      };
    }
    const below = rect.bottom + 16;
    return {
      left: Math.max(16, Math.min(window.innerWidth - width - 16, rect.left)),
      top: below + 330 < window.innerHeight ? below : Math.max(16, rect.top - 320),
    };
  }, [rect]);

  if (!open || !step) return null;
  const final = index === items.length - 1;
  const StepIcon =
    step.target === "child-switcher"
      ? UsersRound
      : step.target === "add-child"
        ? UserPlus
        : MousePointer2;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[1100] bg-navy/25 backdrop-blur-[1px]" aria-hidden />
      {rect && (
        <div
          className="pointer-events-none fixed z-[1101] rounded-2xl border-2 border-amber bg-transparent shadow-[0_0_0_5px_rgba(255,184,83,0.28),0_14px_40px_rgba(7,44,97,0.3)] transition-all duration-300"
          style={{
            top: rect.top - 5,
            left: rect.left - 5,
            width: rect.width + 10,
            height: rect.height + 10,
          }}
        >
          <span className="absolute -right-2 -top-2 h-4 w-4 animate-ping rounded-full bg-amber" />
        </div>
      )}
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Play Hub navigation guide"
        className="ph-rise fixed z-[1102] w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-3xl border border-white/30 bg-card shadow-[0_28px_80px_-18px_rgba(7,44,97,0.55)]"
        style={position}
      >
        <div className="relative bg-navy px-5 pt-5 pb-8 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-blue/35 blur-2xl" />
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[10px] font-bold tracking-[0.14em] uppercase">
              <Map className="h-3.5 w-3.5 text-amber" aria-hidden /> Start guide
            </span>
            <button
              type="button"
              onClick={finish}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[11px] font-bold text-white/75 transition hover:bg-white/20 hover:text-white"
              aria-label="Exit navigation guide"
            >
              <X className="h-3.5 w-3.5" aria-hidden /> Exit guide
            </button>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber text-navy shadow-lg">
              <StepIcon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-semibold text-white/55">
                Step {index + 1} of {items.length}
              </p>
              <h2 className="text-xl font-bold">{step.label}</h2>
            </div>
          </div>
        </div>
        <div className="-mt-3 rounded-t-3xl bg-card px-5 pt-5 pb-4">
          <p className="mb-3 text-sm font-bold text-navy">Your goal: {goalLabel.toLowerCase()}.</p>
          <p className="min-h-12 text-sm leading-relaxed text-navy/70">
            {step.description ??
              COPY[step.label] ??
              "Open this area to continue working in Play Hub."}
          </p>
          <div className="mt-4 flex gap-1.5" aria-label="Tour progress">
            {items.map((item, dot) => (
              <span
                key={`${item.target ?? item.to}-${dot}`}
                className={`h-1.5 flex-1 rounded-full ${dot <= index ? "bg-amber" : "bg-navy/10"}`}
              />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-navy/8 pt-4">
            <button
              type="button"
              onClick={advance}
              className="min-h-10 px-1 text-xs font-bold text-navy/55 transition hover:text-navy"
            >
              Skip step
            </button>
            <div className="flex gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="grid h-10 w-10 place-items-center rounded-full border border-navy/15 text-navy"
                  aria-label="Previous guide step"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (final) {
                    finish();
                    if (goalRoute) void navigate({ to: goalRoute } as never);
                  } else advance();
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-coral px-4 text-xs font-bold text-white shadow-sm"
              >
                {final ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden /> {goalLabel}
                  </>
                ) : (
                  <>
                    Next <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </ModalPortal>
  );
}
