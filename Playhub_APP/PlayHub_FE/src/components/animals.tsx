import { cn } from "@/lib/utils";

/**
 * Hand-drawn animal marks used for the profile stickers (Account → profile picture).
 * All shapes use `currentColor` so they inherit brand tokens (navy / coral / amber / blue).
 */

type AnimalProps = { className?: string; title?: string };

function svgProps(className?: string) {
  return {
    viewBox: "0 0 64 64",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: cn("h-10 w-10", className),
  };
}

export function BunnyMark({ className, title }: AnimalProps) {
  return (
    <svg {...svgProps(className)} role={title ? "img" : "presentation"} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path d="M24 26c-3-7-4-13-2-16 2-3 6 1 8 8" />
      <path d="M40 26c3-7 4-13 2-16-2-3-6 1-8 8" />
      <circle cx="32" cy="40" r="15" />
      <circle cx="26" cy="38" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="38" cy="38" r="1.6" fill="currentColor" stroke="none" />
      <path d="M32 44v2M32 46c-2 2-5 1-5-1M32 46c2 2 5 1 5-1" />
    </svg>
  );
}

export function BearMark({ className, title }: AnimalProps) {
  return (
    <svg {...svgProps(className)} role={title ? "img" : "presentation"} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <circle cx="19" cy="19" r="7" />
      <circle cx="45" cy="19" r="7" />
      <circle cx="32" cy="37" r="17" />
      <circle cx="26" cy="34" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="38" cy="34" r="1.8" fill="currentColor" stroke="none" />
      <ellipse cx="32" cy="42" rx="3" ry="2.2" fill="currentColor" stroke="none" />
      <path d="M28 47c2 2 6 2 8 0" />
    </svg>
  );
}

export function FoxMark({ className, title }: AnimalProps) {
  return (
    <svg {...svgProps(className)} role={title ? "img" : "presentation"} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path d="M12 16c8-2 14 2 20 8 6-6 12-10 20-8-2 8-2 14-4 20-3 9-9 15-16 15S17 45 14 36c-2-6-2-12-2-20Z" />
      <circle cx="25" cy="34" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="39" cy="34" r="1.8" fill="currentColor" stroke="none" />
      <path d="M32 42v3" />
      <circle cx="32" cy="41" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function OwlMark({ className, title }: AnimalProps) {
  return (
    <svg {...svgProps(className)} role={title ? "img" : "presentation"} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path d="M14 24c0-11 8-16 18-16s18 5 18 16v14c0 10-8 16-18 16s-18-6-18-16Z" />
      <circle cx="24" cy="28" r="6" />
      <circle cx="40" cy="28" r="6" />
      <circle cx="24" cy="28" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="40" cy="28" r="1.8" fill="currentColor" stroke="none" />
      <path d="M32 34l-3 4h6l-3-4ZM14 24l4-8M50 24l-4-8" />
    </svg>
  );
}

export function ElephantMark({ className, title }: AnimalProps) {
  return (
    <svg {...svgProps(className)} role={title ? "img" : "presentation"} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path d="M22 20c0-7 5-11 12-11s12 4 12 11v14c0 8-5 13-12 13" />
      <path d="M34 47c0 6-4 9-8 9s-8-3-8-8 4-6 4-11" />
      <path d="M22 22c-7-1-12 3-12 9s5 9 10 8" />
      <circle cx="34" cy="24" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CatMark({ className, title }: AnimalProps) {
  return (
    <svg {...svgProps(className)} role={title ? "img" : "presentation"} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path d="M16 30 14 12l14 8" />
      <path d="M48 30 50 12l-14 8" />
      <circle cx="32" cy="36" r="16" />
      <circle cx="26" cy="34" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="38" cy="34" r="1.8" fill="currentColor" stroke="none" />
      <path d="M32 40v2M32 42c-2 2-4 1-4-1M32 42c2 2 4 1 4-1M14 38h8M42 38h8" />
    </svg>
  );
}

export function TurtleMark({ className, title }: AnimalProps) {
  return (
    <svg {...svgProps(className)} role={title ? "img" : "presentation"} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path d="M14 36c0-11 8-18 18-18s18 7 18 18Z" />
      <path d="M32 18v18M20 30l24 0" />
      <path d="M50 34c4 0 6 2 6 5s-3 4-5 3" />
      <circle cx="54" cy="37" r="1.6" fill="currentColor" stroke="none" />
      <path d="M18 36v6M46 36v6" />
    </svg>
  );
}

export function DuckMark({ className, title }: AnimalProps) {
  return (
    <svg {...svgProps(className)} role={title ? "img" : "presentation"} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <circle cx="26" cy="22" r="10" />
      <path d="M36 22h8l-4 5h-4" />
      <circle cx="24" cy="20" r="1.8" fill="currentColor" stroke="none" />
      <path d="M18 30c-6 3-9 8-9 13 0 6 6 9 14 9h12c8 0 14-4 14-11 0-6-5-10-11-10" />
    </svg>
  );
}
