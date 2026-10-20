import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { HomepageContent } from "@/api/homepage";
import { Logo } from "@/components/brand";

export function HubFooter({ footer }: { footer: HomepageContent["footer"] }) {
  return (
    <footer className="hub-footer sm:px-5 sm:pb-5">
      <div className="hub-footer-surface px-6 py-14 text-cream [border-radius:0] sm:px-10 sm:[border-radius:28px]">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="ph-display text-3xl sm:text-4xl">{footer.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-cream/75">{footer.description}</p>
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
                ["Play Plans", "/plans"],
                ["Progress", "/progress"],
                ["Daily Check-In", "/check-in"],
              ],
            ],
            [
              "Families",
              [
                ["Sign up free", "/dashboard"],
                ["Subscription", "/subscription"],
                ["Invite a Moderator", "/invite"],
              ],
            ],
            [
              "Organisations",
              [
                ["Log in", "/login"],
                ["Enrol a member in a Play Plan", "/org/enroll"],
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
