import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mail, X, KeyRound } from "lucide-react";
import { ModalPortal } from "@/components/ModalPortal";
import { LICENCE_CONTACT_EMAIL } from "@/lib/contact";
import type { LicenseType, Org } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * How many of the organisation's licences are in use, shown where they get used up: the
 * Moderators page for Moderator licences, the children pages for child licences.
 */
export function OrgLicenseNote({ org, kind }: { org: Org | undefined; kind: LicenseType }) {
  if (!org || org.licenseType !== kind || !org.licenses) return null;
  const noun = kind === "moderators" ? "Moderator" : "child";
  const full = org.licensesUsed >= org.licenses;
  const share = Math.min(100, (org.licensesUsed / org.licenses) * 100);
  return (
    <section
      aria-label="Licences"
      className={cn(
        "ph-card mb-5 flex flex-wrap items-center gap-3 p-4",
        full && "border-2 border-coral/30",
      )}
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          full ? "bg-coral/12 text-coral" : "bg-blue/10 text-blue",
        )}
      >
        <KeyRound className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {org.licensesUsed} of {org.licenses} {noun} licence{org.licenses === 1 ? "" : "s"} used
        </p>
        <p className="text-xs text-navy/60">
          {full
            ? `All ${noun} licences are in use. To add more, email ${LICENCE_CONTACT_EMAIL}.`
            : kind === "moderators"
              ? "Each active or invited Moderator uses a licence."
              : "Each active member uses a licence."}
        </p>
      </div>
      <div
        className="ph-pill h-2 w-full overflow-hidden bg-navy/8 sm:w-40"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={org.licenses}
        aria-valuenow={org.licensesUsed}
        aria-label={`${noun} licences used`}
      >
        <div
          className={cn("ph-pill h-full", full ? "bg-coral" : "bg-blue")}
          style={{ width: `${share}%` }}
        />
      </div>
    </section>
  );
}

/**
 * Shown instead of the add or enrol form once every licence of `kind` is used: how to ask the
 * Play Hub team for more.
 */
export function LicenceLimitModal({
  org,
  kind,
  onClose,
}: {
  org: Org;
  kind: LicenseType;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const noun = kind === "moderators" ? "Moderator" : "child";
  const adding = kind === "moderators" ? "add another Moderator" : "enrol another member";
  const subject = `Licence increase for ${org.name}`;
  const body = `Hello Play Hub team,\n\n${org.name} is using all ${org.licenses} ${noun} licences. We'd like to increase our licences to: \n\nThank you.`;
  const mailto = `mailto:${LICENCE_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(LICENCE_CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[80] grid place-items-center bg-navy/40 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="licence-limit-title"
          onClick={(event) => event.stopPropagation()}
          className="ph-card relative w-full max-w-md p-6 text-navy shadow-[var(--shadow-lift)]"
        >
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full text-navy/60 hover:bg-navy/6"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-coral/12 text-coral">
            <KeyRound className="h-6 w-6" aria-hidden />
          </span>
          <h2 id="licence-limit-title" className="mt-4 text-xl font-bold">
            All {noun} licences are in use
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-navy/70">
            {org.name} is using {org.licensesUsed} of {org.licenses} {noun} licences, so you can’t{" "}
            {adding} yet. Contact the Play Hub team to increase your licences.
          </p>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-navy/5 p-3">
            <Mail className="h-4 w-4 shrink-0 text-blue" aria-hidden />
            <a
              href={mailto}
              className="min-w-0 flex-1 truncate text-sm font-bold text-blue hover:underline"
            >
              {LICENCE_CONTACT_EMAIL}
            </a>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[11px] font-bold text-navy ring-1 ring-navy/10 hover:bg-navy/5"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold text-navy/70 hover:bg-navy/6"
            >
              Close
            </button>
            <a
              href={mailto}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white"
            >
              <Mail className="h-4 w-4" aria-hidden /> Email the Play Hub team
            </a>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
