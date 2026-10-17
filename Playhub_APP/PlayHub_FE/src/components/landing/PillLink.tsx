import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "@/auth/session";

export function PillLink({
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
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => setSessionReady(true), []);
  const signedIn = sessionReady && session.role !== "anonymous";
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
