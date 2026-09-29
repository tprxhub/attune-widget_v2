import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import authArt from "@/assets/auth-art.jpg";
import { Logo } from "@/components/brand";

interface AuthLayoutProps {
  children: ReactNode;
  artImage?: string;
}

export function AuthLayout({ children, artImage }: AuthLayoutProps) {
  const artUrl = artImage ?? authArt;
  return (
    <div className="min-h-screen bg-navy">
      <div className="mx-auto grid min-h-screen w-full bg-card lg:grid-cols-2">
        <div className="relative hidden lg:block">
          <div className="sticky top-0 h-screen w-full overflow-hidden bg-navy">
            <img
              src={artUrl}
              alt="A child playing with colourful wooden toys"
              width={1024}
              height={1408}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 top-0 flex justify-center p-8 text-white">
              <Logo />
            </div>
          </div>
        </div>

        <div className="relative flex min-h-screen flex-col px-5 py-6 sm:px-10 sm:py-8 lg:px-14 lg:py-10">
          <div className="mb-5 flex shrink-0 items-center justify-between sm:mb-6">
            <Link
              to="/"
              aria-label="Back to home"
              className="group inline-flex items-center gap-2 rounded-full px-2 py-2 -ml-2 text-navy transition-colors hover:bg-navy/6"
            >
              <ArrowLeft
                className="h-5 w-5 transition-transform group-hover:-translate-x-0.5"
                aria-hidden
              />
              <span className="text-sm font-semibold">Back to homepage</span>
            </Link>
            <span className="text-navy lg:hidden">
              <Logo />
            </span>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="mx-auto my-auto w-full max-w-md py-2">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const authInput =
  "mt-2 min-h-13 w-full rounded-full border border-navy/20 bg-card px-5 text-sm text-navy placeholder:text-navy/40 focus:border-navy focus:outline-none";
export const authLabel = "text-sm font-semibold text-navy";
export const authButton =
  "flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-navy text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60";
export const authSocial =
  "flex min-h-13 w-full items-center justify-center gap-3 rounded-full border border-navy/18 bg-card text-sm font-semibold text-navy transition-colors hover:bg-navy/4";
