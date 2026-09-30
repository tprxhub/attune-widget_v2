import { Bot, MessagesSquare, Stethoscope } from "lucide-react";

const TILES = [
  {
    key: "attune",
    icon: Bot,
    title: "Attune™ by Toy Pharmacy",
    desc: "Your AI play mate — real-time help on any Play Plan Activity.",
    tone: "bg-navy/10 text-navy",
  },
  {
    key: "community",
    icon: MessagesSquare,
    title: "Community Chat",
    desc: "Swap wins with other parents walking the same path.",
    tone: "bg-amber/30 text-navy",
  },
];

/** Upcoming features, shown at the bottom of every dashboard. */
export function ComingSoonTiles() {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {TILES.map(({ key, icon: Icon, title, desc, tone }) => (
        <div key={key} className="ph-card relative p-5">
          <span className="absolute top-4 right-4 rounded-full bg-navy/8 px-2.5 py-1 text-[10px] font-bold tracking-wide text-navy/60 uppercase">
            Coming soon
          </span>
          <span className={`inline-grid h-13 w-13 place-items-center rounded-2xl ${tone}`}>
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3.5 text-base font-bold">{title}</p>
          <p className="mt-1 text-sm text-navy/60">{desc}</p>
        </div>
      ))}
    </div>
  );
}

/** Link to book a 1:1 Play Consultation. */
export function ConsultationCard() {
  return (
    <section className="ph-card mt-4 flex flex-wrap items-center gap-4 border-l-4 border-coral p-5">
      <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-coral/12 text-coral">
        <Stethoscope className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-[180px] flex-1">
        <p className="text-sm font-bold">Something not quite right?</p>
        <p className="mt-0.5 text-sm text-navy/60">
          Book a 1:1 Play Consultation with one of our child psychologists for tailored guidance.
        </p>
      </div>
      <a
        href="https://thetoypharmacy.com/products/play-consult-call"
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center rounded-full bg-coral px-5 text-sm font-bold text-white"
      >
        Book a 1:1 Play Consultation
      </a>
    </section>
  );
}
