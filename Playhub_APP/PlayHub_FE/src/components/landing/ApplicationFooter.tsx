import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand";
import type { HomepageContent } from "@/api/homepage";
import { PillLink } from "./PillLink";

export function ApplicationFooter({
  footer,
  signedIn,
  showCta = true,
}: {
  footer: HomepageContent["footer"];
  signedIn: boolean;
  showCta?: boolean;
}) {
  return (
    <footer className="sm:px-5 sm:pb-5">
      <div className="bg-navy px-6 py-14 text-cream [border-radius:0] sm:px-10 sm:[border-radius:28px]">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="ph-display text-3xl sm:text-4xl">{footer.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-cream/75">{footer.description}</p>
          {showCta && (
            <div className="mt-8 flex justify-center">
              <PillLink to="/dashboard" fallbackTo="/signup">
                {footer.button_label}
              </PillLink>
            </div>
          )}
        </div>

        <div className="mx-auto mt-14 grid max-w-7xl gap-10 border-t border-cream/15 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="[&_span]:text-cream">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/65">{footer.blurb}</p>
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
                ["Sign up free", signedIn ? "/dashboard" : "/signup"],
                ["Subscription", signedIn ? "/subscription" : "/login"],
                ["Invite a Moderator", signedIn ? "/invite" : "/login"],
              ],
            ],
            [
              "Organisations",
              [
                ["Log in", "/login"],
                ["Enrol a child in a Play Plan", signedIn ? "/org/enroll" : "/login"],
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
            © {new Date().getFullYear()} {footer.copyright}
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
  );
}
