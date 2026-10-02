import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, GraduationCap, HeartHandshake, Quote } from "lucide-react";
import { GOALS } from "@/api/domain";
import { apiAssetUrl } from "@/api/client";
import { DEFAULT_HOMEPAGE_CONTENT, HOMEPAGE_QUERY_KEY, loadHomepage } from "@/api/homepage";
import { Logo } from "@/components/brand";
import { GoalIcon } from "@/components/icons";
import { GuideButton } from "@/features/guide/GuideDialog";
import { LEVELS } from "@/lib/types";
import { useSession } from "@/auth/session";
import heroKids from "@/assets/hero-kids-playing.jpg";
import kidsHands from "@/assets/kids-hands-beads.jpg";
import playTweezers from "@/assets/play-tweezers.jpg";
import parentPencil from "@/assets/parent-child-pencil.jpg";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1537655780520-1e392ead81f2?q=80&w=2940&auto=format&fit=crop&ixlib=rb-4.1.0";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Play Hub — Play Plans for children's fine motor skills" },
      {
        name: "description",
        content:
          "Play Hub by The Toy Pharmacy turns therapy goals into weekly Play Plans of short, loggable Play Doses — for families, schools and clinics.",
      },
      { property: "og:title", content: "Play Hub — Play Plans for children's fine motor skills" },
      {
        property: "og:description",
        content:
          "Weekly Play Plans of short, loggable Play Doses for families, schools and clinics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: HERO_IMAGE },
      { name: "twitter:image", content: HERO_IMAGE },
    ],
  }),
  component: Landing,
});

const JOURNEY_IMAGES = [kidsHands, playTweezers, parentPencil];

/** Saved copy from the Super Admin editor, over the built-in text. */
function useHomepage() {
  const { data } = useQuery({
    queryKey: HOMEPAGE_QUERY_KEY,
    queryFn: loadHomepage,
    staleTime: 60_000,
    retry: false,
  });
  return data?.content ?? DEFAULT_HOMEPAGE_CONTENT;
}

function PillLink({
  to,
  fallbackTo = "/login",
  children,
  tone = "cream",
}: {
  to: string;
  fallbackTo?: string;
  children: string;
  tone?: "cream" | "navy" | "outline";
}) {
  const { session } = useSession();
  const signedIn = session.role !== "anonymous";
  const target = signedIn ? to : fallbackTo;
  const base =
    "group ph-pill inline-flex min-h-12 items-center gap-3 pr-2 pl-6 text-sm font-semibold tracking-wide transition-colors";
  const styles =
    tone === "cream"
      ? "bg-cream text-navy hover:bg-white"
      : tone === "navy"
        ? "bg-navy text-cream hover:bg-navy/90"
        : "border border-navy/25 text-navy hover:bg-navy/5";
  const dot =
    tone === "cream"
      ? "bg-coral text-white"
      : tone === "navy"
        ? "bg-amber text-navy"
        : "bg-navy text-cream";
  return (
    <Link to={target} className={`${base} ${styles}`}>
      {children}
      <span
        className={`ph-pill grid h-9 w-9 place-items-center ${dot} transition-transform group-hover:translate-x-0.5`}
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}

function Eyebrow({ children, tone = "dark" }: { children: string; tone?: "dark" | "light" }) {
  return (
    <p
      className={`text-[11px] font-semibold tracking-[0.22em] uppercase ${
        tone === "light" ? "text-cream/60" : "text-navy/45"
      }`}
    >
      {children}
    </p>
  );
}

function StickyNav({ signedIn, homePath }: { signedIn: boolean; homePath: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nav = [
    ["Play Pulse", "/play-pulse"],
    ["Play Plans", signedIn ? "/plans" : "/login"],
    ["Progress", signedIn ? "/progress" : "/login"],
    ["Pricing", signedIn ? "/subscription" : "/login"],
  ] as const;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-cream/95 shadow-[var(--shadow-card)] backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-2 pb-4 sm:px-6 lg:pt-7 lg:pb-5">
        <Link to="/" className={scrolled ? "" : "[&_span]:text-cream"}>
          <Logo />
        </Link>

        <nav
          aria-label="Main"
          className={`ph-pill hidden min-h-11 items-center gap-1 px-2 py-1.5 backdrop-blur-md lg:flex ${
            scrolled ? "bg-navy/6" : "bg-cream/12"
          }`}
        >
          {nav.map(([label, to]) => (
            <Link
              key={label}
              to={to}
              className={`ph-pill inline-flex min-h-9 items-center justify-center px-4 text-xs font-semibold transition-colors ${
                scrolled
                  ? "text-navy/80 hover:bg-navy/8 hover:text-navy"
                  : "text-cream/85 hover:bg-cream/15 hover:text-cream"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className={`hidden sm:inline ${scrolled ? "" : "text-cream"}`}>
            <GuideButton />
          </span>
          {signedIn ? (
            <Link
              to={homePath}
              className={`ph-pill inline-flex min-h-11 items-center px-5 text-sm font-semibold ${
                scrolled ? "bg-navy text-cream" : "bg-cream text-navy"
              }`}
            >
              Open Play Hub
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className={`ph-pill hidden min-h-11 items-center px-4 text-sm font-semibold sm:inline-flex ${
                  scrolled ? "text-navy hover:bg-navy/6" : "text-cream hover:bg-cream/15"
                }`}
              >
                Log in
              </Link>
              <Link
                to="/login"
                className={`ph-pill inline-flex min-h-11 items-center px-5 text-sm font-semibold ${
                  scrolled ? "bg-navy text-cream" : "bg-cream text-navy"
                }`}
              >
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Landing() {
  const { session } = useSession();
  const signedIn = session.role !== "anonymous";
  const home = useHomepage();
  const gridColumns =
    home.stories.quotes.length === 1
      ? "md:mx-auto md:max-w-xl md:grid-cols-1"
      : home.stories.quotes.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-3";

  return (
    <div className="min-h-screen bg-cream">
      <StickyNav signedIn={signedIn} homePath={session.homePath} />
      <main className="px-1 sm:px-5">
        {/* ── Hero ── */}
        <section className="relative isolate -mx-1 -mt-[88px] overflow-hidden pt-[78px] sm:-mx-5 sm:-mt-[88px] sm:pt-[88px] lg:-mt-[112px] lg:pt-[120px]">
          <img
            src={apiAssetUrl(home.hero.image_url) || HERO_IMAGE}
            alt="A child playing outdoors with bright colourful toys"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-r from-navy/92 via-navy/70 to-navy/35"
            aria-hidden
          />

          <div className="relative z-10 mx-auto max-w-7xl px-5 pt-20 pb-12 sm:px-8 sm:pt-24 sm:pb-16 lg:pt-28 lg:pb-20">
            <Eyebrow tone="light">{home.hero.eyebrow}</Eyebrow>
            <h1 className="ph-display mt-5 max-w-3xl text-[42px] leading-[1.02] text-cream sm:text-[66px] lg:text-[80px]">
              {home.hero.title}
              <span className="block text-amber italic">{home.hero.title_highlight}</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-cream/85 sm:text-lg">
              {home.hero.description}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PillLink to="/dashboard">{home.hero.primary_cta}</PillLink>
              <Link
                to={signedIn ? "/org" : "/login"}
                className="ph-pill inline-flex min-h-12 items-center border border-cream/40 px-6 text-sm font-semibold text-cream hover:bg-cream/10"
              >
                {home.hero.secondary_cta}
              </Link>
            </div>
            <p className="mt-8 text-xs text-cream/60">{home.hero.footnote}</p>
          </div>
        </section>

        {/* ── Your play journey ── */}
        <section className="mx-auto max-w-7xl px-2 py-16 sm:px-4 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow>{home.journey.eyebrow}</Eyebrow>
              <h2 className="ph-display mt-3 text-4xl leading-tight sm:text-5xl">
                {home.journey.title}
              </h2>
            </div>
            <GuideButton />
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {home.journey.steps.map((step, i) => {
              const highlight = i === 1;
              return (
                <article
                  key={i}
                  className={`ph-r-xl overflow-hidden p-3 ${highlight ? "bg-navy" : "bg-card shadow-card"}`}
                >
                  {highlight ? (
                    <div className="px-3 pt-3 pb-5">
                      <div className="flex items-center gap-3">
                        <span className="ph-pill grid h-7 w-7 place-items-center bg-amber text-xs font-bold text-navy">
                          {i + 1}
                        </span>
                        <h3 className="ph-display text-xl text-cream uppercase">{step.title}</h3>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-cream/75">{step.body}</p>
                    </div>
                  ) : null}
                  <img
                    src={apiAssetUrl(step.image_url) || JOURNEY_IMAGES[i]}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="ph-r-lg h-52 w-full object-cover"
                  />
                  {!highlight ? (
                    <div className="px-3 pt-5 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="ph-pill grid h-7 w-7 place-items-center border border-navy/25 text-xs font-bold text-navy">
                          {i + 1}
                        </span>
                        <h3 className="ph-display text-xl text-navy uppercase">{step.title}</h3>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-navy/65">{step.body}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Skill areas, compact editorial bento ── */}
        <section className="relative isolate -mx-1 overflow-hidden bg-navy py-14 sm:-mx-5 lg:py-20">
          <div
            className="ph-pill pointer-events-none absolute -top-32 -right-24 -z-10 h-96 w-96 bg-blue/25 blur-3xl"
            aria-hidden
          />
          <div
            className="ph-pill pointer-events-none absolute -bottom-48 -left-32 -z-10 h-96 w-96 bg-coral/15 blur-3xl"
            aria-hidden
          />

          <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="grid items-end gap-7 border-b border-cream/15 pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
              <div>
                <div className="flex items-center gap-3">
                  <span className="ph-pill h-2 w-2 bg-amber" aria-hidden />
                  <Eyebrow tone="light">{`Skills library · ${GOALS.length} focus areas`}</Eyebrow>
                </div>
                <h2 className="ph-display mt-4 max-w-2xl text-4xl leading-[1.08] text-cream sm:text-5xl lg:text-6xl">
                  {home.skills.title}
                </h2>
              </div>
              <div className="lg:pb-1">
                <p className="max-w-lg text-base leading-relaxed text-cream/70">
                  {home.skills.description}
                </p>
                <div className="mt-6">
                  <PillLink to="/plans">{home.skills.button_label}</PillLink>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
              <Link
                to="/plans"
                className="ph-r-2xl group relative flex min-h-[320px] overflow-hidden bg-amber p-6 text-navy sm:p-8 lg:min-h-full"
              >
                <div
                  className="ph-pill absolute -right-16 -bottom-20 h-64 w-64 border-[44px] border-cream/35 transition-transform duration-500 group-hover:scale-105"
                  aria-hidden
                />
                <div className="relative z-10 flex w-full flex-col">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-bold tracking-[0.16em] text-navy/55 uppercase">
                      Featured focus
                    </span>
                    <span className="ph-display text-base font-bold tracking-[0.16em] text-navy/55">
                      01 / 07
                    </span>
                  </div>

                  <div className="mt-auto pt-16">
                    <h3 className="ph-display mt-2 max-w-sm text-3xl leading-tight sm:text-4xl">
                      {GOALS[0]?.name}
                    </h3>
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-navy/70">
                      {GOALS[0]?.blurb}
                    </p>
                    <div className="mt-6 flex items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-2">
                        {LEVELS.map((level) => (
                          <span
                            key={level}
                            className="ph-pill border border-navy/20 bg-cream/25 px-3 py-1.5 text-[11px] font-bold"
                          >
                            {level}
                          </span>
                        ))}
                      </div>
                      <span className="ph-pill grid h-11 w-11 shrink-0 place-items-center bg-coral text-white transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
                        <ArrowUpRight className="h-5 w-5" aria-hidden />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              <ul className="grid grid-cols-2 gap-3">
                {GOALS.slice(1).map((goal, index) => (
                  <li key={goal.id}>
                    <Link
                      to="/plans"
                      className="ph-r-lg group flex h-full min-h-40 flex-col border border-cream/10 bg-cream/7 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-cream/20 hover:bg-cream/12 sm:min-h-44 sm:p-5"
                    >
                      <div className="flex justify-end">
                        <span className="ph-display text-lg font-bold tracking-[0.14em] text-cream/45">
                          {String(index + 2).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                        <div>
                          <h3 className="ph-display text-xl leading-snug text-cream">
                            {goal.short}
                          </h3>
                          <p className="mt-2 hidden line-clamp-2 text-xs leading-relaxed text-cream/55 sm:block">
                            {goal.blurb}
                          </p>
                        </div>
                        <ArrowUpRight
                          className="mb-0.5 h-4 w-4 shrink-0 text-cream/35 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber"
                          aria-hidden
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex justify-end border-t border-cream/15 pt-6">
              <Link
                to="/plans"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-cream"
              >
                {home.skills.all_plans_label.replace(/\b21\s+/, "")}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </section>

        {/* ── The week ── */}
        <section className="-mx-1 py-16 sm:mx-auto sm:max-w-7xl sm:px-4 lg:py-24">
          <div className="relative isolate overflow-hidden px-6 py-12 [border-radius:0] sm:px-12 sm:py-16 sm:[border-radius:28px]">
            <img
              src={apiAssetUrl(home.week.image_url) || heroKids}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-r from-navy/92 to-navy/55"
              aria-hidden
            />
            <Eyebrow tone="light">{home.week.eyebrow}</Eyebrow>
            <h2 className="ph-display mt-4 max-w-lg text-4xl leading-tight text-cream sm:text-5xl">
              {home.week.title}{" "}
              <span className="text-amber italic">{home.week.title_highlight}</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-cream/80">
              {home.week.description}
            </p>
            <div className="mt-8">
              <PillLink to="/check-in">{home.week.button_label}</PillLink>
            </div>
          </div>

          <ol className="mt-12 grid border-y border-navy/15 sm:grid-cols-2 lg:grid-cols-4">
            {home.week.steps.map((step, i) => (
              <li
                key={i}
                className="group border-b border-navy/15 px-5 py-8 sm:px-6 sm:nth-[2n]:border-l lg:border-r lg:border-b-0 lg:px-7 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`ph-display text-3xl leading-none ${
                      i === 2 ? "text-coral" : "text-navy"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`h-px flex-1 transition-colors ${
                      i === 2 ? "bg-coral/40" : "bg-navy/15 group-hover:bg-navy/30"
                    }`}
                    aria-hidden
                  />
                </div>
                <p className="mt-8 text-[11px] font-bold tracking-[0.18em] text-coral uppercase">
                  {step.when}
                </p>
                <h3 className="ph-display mt-3 text-2xl leading-snug text-navy">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-navy/65">{step.body}</p>
              </li>
            ))}
          </ol>

          <dl className="grid border-b border-navy/15 sm:grid-cols-2 lg:grid-cols-4">
            {home.week.stats.map((stat, i) => (
              <div
                key={i}
                className="flex items-baseline gap-4 border-b border-navy/15 px-5 py-6 sm:px-6 sm:nth-[2n]:border-l lg:border-r lg:border-b-0 lg:px-7 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <dt className="ph-display shrink-0 text-4xl leading-none text-navy">
                  {stat.value}
                </dt>
                <dd className="text-xs leading-relaxed text-navy/60">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Levels ── */}
        <section className="-mx-1 pb-16 sm:mx-auto sm:w-[90%] lg:pb-24">
          <div className="relative isolate overflow-hidden bg-amber px-5 py-10 [border-radius:0] sm:px-10 sm:py-12 sm:[border-radius:28px]">
            <div
              className="ph-pill pointer-events-none absolute -top-40 -left-28 -z-10 h-80 w-80 border-[56px] border-cream/30"
              aria-hidden
            />
            <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16">
              <div>
                <div className="flex items-center gap-3">
                  <span className="ph-pill h-2 w-2 bg-coral" aria-hidden />
                  <Eyebrow>{home.levels.eyebrow}</Eyebrow>
                </div>
                <h2 className="ph-display mt-5 max-w-xl text-4xl leading-[1.12] text-navy sm:text-5xl">
                  {home.levels.title}
                </h2>
                <div className="mt-8 flex items-center gap-3" aria-hidden>
                  <span className="h-1 w-14 bg-coral" />
                  <span className="h-1 w-8 bg-navy" />
                  <span className="h-1 w-4 bg-blue" />
                </div>
              </div>

              <div className="ph-r-2xl bg-cream/55 p-2 shadow-lift backdrop-blur-sm">
                {LEVELS.map((level, i) => {
                  const highlight = i === 1;
                  return (
                    <div
                      key={level}
                      className={`ph-r-lg grid gap-4 p-5 sm:grid-cols-[64px_120px_1fr] sm:items-center sm:gap-5 sm:p-6 ${
                        highlight ? "bg-navy text-cream shadow-lift" : "text-navy"
                      }`}
                    >
                      <span
                        className={`ph-display text-4xl leading-none ${
                          highlight ? "text-amber" : "text-navy/20"
                        }`}
                      >
                        0{i + 1}
                      </span>
                      <h3 className="ph-display text-2xl">{level}</h3>
                      <p
                        className={`text-sm leading-relaxed ${
                          highlight ? "text-cream/65" : "text-navy/60"
                        }`}
                      >
                        {home.levels.descriptions[i]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Stories ── */}
        <section className="mx-auto max-w-7xl px-2 pb-16 text-center sm:px-4 lg:pb-24">
          <h2 className="ph-display text-4xl sm:text-5xl">{home.stories.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-navy/65">
            {home.stories.subtitle}
          </p>
          <div className={`mt-10 grid gap-5 text-left md:items-center ${gridColumns}`}>
            {home.stories.quotes.map((q, i) => {
              const highlight = i === 1;
              return (
                <figure
                  key={i}
                  className={`ph-r-lg p-7 ${highlight ? "bg-navy md:scale-[1.04]" : "bg-card shadow-card"}`}
                >
                  <Quote
                    className={`h-6 w-6 ${highlight ? "text-amber" : "text-coral"}`}
                    aria-hidden
                  />
                  <blockquote
                    className={`mt-4 text-base leading-relaxed ${highlight ? "text-cream/90" : "text-navy/80"}`}
                  >
                    {q.quote}
                  </blockquote>
                  <figcaption
                    className={`mt-6 border-t pt-4 text-xs font-bold ${
                      highlight ? "border-cream/20 text-cream" : "border-navy/12 text-navy"
                    }`}
                  >
                    {q.name}
                    <span
                      className={`block font-semibold ${highlight ? "text-cream/55" : "text-navy/50"}`}
                    >
                      {q.role}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>

        {/* ── Two ways in ── */}
        <section className="mx-auto max-w-7xl px-2 pb-16 sm:px-4 lg:pb-20">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="ph-r-xl bg-card p-8 shadow-card sm:p-10">
              <HeartHandshake className="h-7 w-7 text-coral" aria-hidden />
              <h3 className="ph-display mt-5 text-3xl text-navy">{home.families.title}</h3>
              <p className="mt-4 text-base leading-relaxed text-navy/70">{home.families.body}</p>
              <div className="mt-8">
                <PillLink to="/dashboard" tone="navy">
                  {home.families.button_label}
                </PillLink>
              </div>
            </div>
            <div className="ph-r-xl bg-card p-8 shadow-card sm:p-10">
              <GraduationCap className="h-7 w-7 text-blue" aria-hidden />
              <h3 className="ph-display mt-5 text-3xl text-navy">{home.schools.title}</h3>
              <p className="mt-4 text-base leading-relaxed text-navy/70">{home.schools.body}</p>
              <div className="mt-8">
                <PillLink to="/org" tone="outline">
                  {home.schools.button_label}
                </PillLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="sm:px-5 sm:pb-5">
        <div className="bg-navy px-6 py-14 text-cream [border-radius:0] sm:px-10 sm:[border-radius:28px]">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="ph-display text-3xl sm:text-4xl">{home.footer.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-cream/75">
              {home.footer.description}
            </p>
            <div className="mt-8 flex justify-center">
              <PillLink to="/dashboard">{home.footer.button_label}</PillLink>
            </div>
          </div>

          <div className="mx-auto mt-14 grid max-w-7xl gap-10 border-t border-cream/15 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="[&_span]:text-cream">
              <Logo />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/65">
                {home.footer.blurb}
              </p>
            </div>
            {[
              [
                "Play Hub",
                [
                  ["Play Pulse", "/play-pulse"],
                  ["Play Plans", signedIn ? "/plans" : "/login"],
                  ["Progress", signedIn ? "/progress" : "/login"],
                  ["Daily Check-In", signedIn ? "/check-in" : "/login"],
                ],
              ],
              [
                "Families",
                [
                  ["Sign up free", signedIn ? "/dashboard" : "/login"],
                  ["Subscription", signedIn ? "/subscription" : "/login"],
                  ["Invite a Moderator", signedIn ? "/invite" : "/login"],
                ],
              ],
              [
                "Organisations",
                [
                  ["Log in", "/login"],
                  ["Enrol a child", signedIn ? "/org/enroll" : "/login"],
                ],
              ],
            ].map(([title, links]) => (
              <div key={String(title)}>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-cream/50 uppercase">
                  {String(title)}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {(links as [string, string][]).map(([label, to]) => (
                    <li key={label}>
                      <Link
                        to={to}
                        className="inline-flex items-center gap-1.5 text-sm text-cream/80 hover:text-amber"
                      >
                        {label}
                        <ArrowRight
                          className="h-3 w-3 opacity-0 transition-opacity hover:opacity-100"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-xs text-cream/45">
            <p>
              © {new Date().getFullYear()} {home.footer.copyright}
            </p>
            <nav aria-label="Legal" className="flex gap-5">
              <Link to="/policies/privacy-policy" className="hover:text-amber">
                Privacy policy
              </Link>
              <Link to="/policies/terms-of-service" className="hover:text-amber">
                Terms of service
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
