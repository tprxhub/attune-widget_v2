import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, Check, Copy, Loader2, Share2, ShieldAlert, X } from "lucide-react";
import { summariseAttuneAnswer, type AttuneReference } from "@/api/attune";
import { ModalPortal } from "@/components/ModalPortal";
import { cn } from "@/lib/utils";

/**
 * The research icon under an answer: tap to see which clinical frameworks or literature from
 * Attune's source register informed it. Plain text, no links (v1).
 */
export function ReferencesToggle({
  references,
  open,
  onToggle,
  panelId,
}: {
  references: AttuneReference[];
  open: boolean;
  onToggle: () => void;
  panelId: string;
}) {
  if (!references.length) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={open ? "Hide references" : "Show references"}
      title="References"
      className={cn(
        "ph-pill grid h-7 w-7 place-items-center transition hover:bg-navy/6",
        open ? "bg-blue/10 text-blue" : "text-navy/50 hover:text-navy",
      )}
    >
      <BookOpenText className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

export function ReferencesPanel({ references, id }: { references: AttuneReference[]; id: string }) {
  return (
    <div id={id} className="ph-r-xl mt-2 border border-navy/10 bg-navy/[0.03] px-4 py-3">
      <p className="text-[11px] font-bold tracking-[0.12em] text-navy/55 uppercase">
        What informed this answer
      </p>
      <ul className="mt-2 space-y-1 text-sm text-navy/75">
        {references.map((reference) => (
          <li key={reference.id} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-navy/40" aria-hidden />
            {reference.title}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-navy/50">
        Attune is an OT-informed tool created by a licensed occupational therapist. It doesn’t
        replace medical advice, diagnosis or individual care.
      </p>
    </div>
  );
}

/** Shown with an answer that used the safety pathway: who to call, right now. */
export function SafetyNotice() {
  return (
    <div
      role="alert"
      className="ph-r-xl mb-3 flex gap-3 border border-coral/40 bg-coral/8 px-4 py-3 text-sm text-navy"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-coral" aria-hidden />
      <div className="min-w-0">
        <p className="font-bold">If anyone may be in danger right now, get help first.</p>
        <p className="mt-1 text-navy/75">
          In the UAE call{" "}
          <a href="tel:999" className="font-bold text-coral underline underline-offset-2">
            999
          </a>{" "}
          for the police or{" "}
          <a href="tel:998" className="font-bold text-coral underline underline-offset-2">
            998
          </a>{" "}
          for an ambulance. Elsewhere, call your local emergency number.
        </p>
      </div>
    </div>
  );
}

/** "Share this": a short, plain-language handover note for a partner, nanny, teacher or therapist. */
export function ShareThisButton({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ph-pill inline-flex h-7 items-center gap-1.5 px-2.5 text-[11px] font-bold text-navy/60 transition hover:bg-navy/6 hover:text-navy"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden /> Share this
      </button>
      {open && <ShareDialog messageId={messageId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareDialog({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  // One request per answer, kept for the session: reopening the note is instant.
  const summary = useQuery({
    queryKey: ["attune", "summary", messageId],
    queryFn: () => summariseAttuneAnswer(messageId),
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const text = summary.data ?? "";
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[80] grid place-items-center bg-navy/40 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(event) => event.stopPropagation()}
          className="ph-card relative flex max-h-[90vh] w-full max-w-lg flex-col p-6 text-navy shadow-[var(--shadow-lift)]"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full text-navy/60 hover:bg-navy/6"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <h2 id={titleId} className="pr-10 text-xl font-bold">
            Share this
          </h2>
          <p className="mt-1 text-sm text-navy/60">
            A short note for a partner, nanny, grandparent, teacher or therapist who wasn’t part of
            this chat.
          </p>
          <div className="ph-r-xl mt-4 min-h-32 overflow-y-auto border border-navy/10 bg-navy/[0.03] p-4">
            {summary.isPending ? (
              <p className="flex items-center gap-2 text-sm text-navy/60" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Writing the note…
              </p>
            ) : summary.isError ? (
              <div>
                <p role="alert" className="text-sm font-semibold text-coral">
                  {summary.error instanceof Error
                    ? summary.error.message
                    : "The note couldn’t be written just now."}
                </p>
                <button
                  type="button"
                  onClick={() => void summary.refetch()}
                  className="mt-2 text-xs font-bold text-navy underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-[15px] leading-relaxed" dir="auto">
                {text.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={!text}
              onClick={() => {
                void navigator.clipboard?.writeText(text).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}
              className="ph-pill inline-flex min-h-11 items-center gap-2 border border-navy/15 px-4 text-sm font-bold text-navy hover:bg-navy/5 disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy note"}
            </button>
            {canShare && (
              <button
                type="button"
                disabled={!text}
                onClick={() => void navigator.share({ text }).catch(() => undefined)}
                className="ph-pill inline-flex min-h-11 items-center gap-2 bg-navy px-4 text-sm font-bold text-cream hover:bg-navy/90 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" aria-hidden /> Share
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
