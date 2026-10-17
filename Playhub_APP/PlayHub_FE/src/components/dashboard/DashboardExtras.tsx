import { MessagesSquare, Stethoscope } from "lucide-react";
import { CONSULT_BOOKING_URL } from "@/lib/contact";

/** Features still to come, shown at the bottom of every dashboard (Attune has its own bar at the top). */
export function ComingSoonTiles() {
  return (
    <div className="mt-5 grid gap-3">
      <div className="ph-card flex items-center gap-3 px-4 py-3">
        <span className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber/30 text-navy">
          <MessagesSquare className="h-4.5 w-4.5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm font-bold">Community Chat</p>
        <span className="shrink-0 rounded-full bg-navy/8 px-2.5 py-1 text-[10px] font-bold tracking-wide text-navy/60 uppercase">
          Coming soon
        </span>
      </div>
    </div>
  );
}

/** Link to book a 1:1 Play Consultation. */
export function ConsultationCard() {
  return (
    <section className="ph-card mt-3 flex flex-wrap items-center gap-3 border-l-4 border-coral px-4 py-3">
      <span className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral/12 text-coral">
        <Stethoscope className="h-4.5 w-4.5" aria-hidden />
      </span>
      <div className="min-w-[180px] flex-1">
        <p className="text-sm font-bold">Something not quite right?</p>
        <p className="text-xs text-navy/60">
          Book a 1:1 Play Consultation with one of our child psychologists for tailored guidance.
        </p>
      </div>
      <a
        href={CONSULT_BOOKING_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-10 items-center rounded-full bg-coral px-4 text-sm font-bold text-white"
      >
        Book a 1:1 Play Consultation
      </a>
    </section>
  );
}
