import type { SVGProps } from "react";

/** Three sliders, used on the Hub's Customize controls. */
export function CustomizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      {...props}
    >
      <path d="M3 5h10.5M18.5 5H21" />
      <circle cx="16" cy="5" r="2.5" />
      <path d="M3 12h1.5M9.5 12H21" />
      <circle cx="7" cy="12" r="2.5" />
      <path d="M3 19h13.5" />
      <circle cx="19" cy="19" r="2.5" />
    </svg>
  );
}
