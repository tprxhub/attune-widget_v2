import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/ModalPortal";
import { cn } from "@/lib/utils";
import { PolicyBody } from "./PolicyLayout";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "./privacy";
import { TERMS_INTRO, TERMS_SECTIONS } from "./terms";

export type PolicyKey = "terms" | "privacy";

const POLICIES = {
  terms: { title: "Terms of service", intro: TERMS_INTRO, sections: TERMS_SECTIONS },
  privacy: { title: "Privacy policy", intro: PRIVACY_INTRO, sections: PRIVACY_SECTIONS },
} as const;

/**
 * The Terms of service and Privacy policy in a dialog, so people can read them without leaving
 * a half-filled sign-up form. `onAgree` adds an "I agree" button that ticks the form's box.
 */
export function PolicyModal({
  initial = "terms",
  onClose,
  onAgree,
}: {
  initial?: PolicyKey;
  onClose: () => void;
  onAgree?: () => void;
}) {
  const [active, setActive] = useState<PolicyKey>(initial);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const policy = POLICIES[active];

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [active]);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] grid place-items-center bg-navy/55 p-3 backdrop-blur-sm sm:p-6"
        onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-modal-title"
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-cream text-navy shadow-lift"
        >
          <header className="flex items-start justify-between gap-4 border-b border-navy/10 px-5 pt-5 pb-4 sm:px-8">
            <div className="min-w-0">
              <h2 id="policy-modal-title" className="ph-display text-2xl sm:text-3xl">
                {policy.title}
              </h2>
              <div className="mt-3 flex gap-2" role="tablist" aria-label="Policies">
                {(Object.keys(POLICIES) as PolicyKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active === key}
                    onClick={() => setActive(key)}
                    className={cn(
                      "min-h-9 rounded-full px-4 text-xs font-bold transition-colors",
                      active === key
                        ? "bg-navy text-cream"
                        : "border border-navy/15 text-navy hover:border-navy/35",
                    )}
                  >
                    {POLICIES[key].title}
                  </button>
                ))}
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-1 rounded-full p-2 text-navy/60 hover:bg-navy/8 hover:text-navy"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-8 [&>div:first-child]:mt-5"
          >
            <PolicyBody intro={policy.intro} sections={policy.sections} />
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-navy/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-full border border-navy/20 px-5 text-sm font-bold hover:bg-navy/5"
            >
              Close
            </button>
            {onAgree && (
              <button
                type="button"
                onClick={() => {
                  onAgree();
                  onClose();
                }}
                className="min-h-11 rounded-full bg-navy px-6 text-sm font-bold text-cream hover:bg-blue"
              >
                I agree
              </button>
            )}
          </footer>
        </div>
      </div>
    </ModalPortal>
  );
}
