import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand";

export interface PolicySection {
  heading?: string;
  paragraphs?: string[];
  items?: string[];
  /** Paragraphs shown after the bullet list. */
  after?: string[];
}

export function PolicyLayout({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: string[];
  sections: PolicySection[];
}) {
  return (
    <div className="min-h-screen bg-cream text-navy">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link to="/" aria-label="Play Hub home">
          <Logo />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20">
        <h1 className="ph-display text-4xl sm:text-5xl">{title}</h1>
        <PolicyBody intro={intro} sections={sections} />
      </main>
    </div>
  );
}

/** The policy text itself, shared by the full page and the sign-up modal. */
export function PolicyBody({
  intro,
  sections,
}: {
  intro?: string[] | undefined;
  sections: PolicySection[];
}) {
  return (
    <>
      <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-navy/80">
        {intro?.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {sections.map((section, i) => (
        <section key={section.heading ?? i} className="mt-10">
          {section.heading && (
            <h2 className="text-lg font-bold tracking-wide text-navy uppercase">
              {section.heading}
            </h2>
          )}
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-navy/80">
            {section.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.items && (
              <ul className="list-disc space-y-1.5 pl-5">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.after?.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
