import { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * The Dashboard icon used across Play Hub: four rounded blocks in a layout grid, solid in the
 * current text colour. Shaped like a Lucide icon so it can stand in for one in navigation lists.
 */
export const DashboardIcon = forwardRef<SVGSVGElement, LucideProps>(function DashboardIcon(
  { className, color, size, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, ...rest },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={size ?? 24}
      height={size ?? 24}
      fill={color ?? "currentColor"}
      className={className}
      aria-hidden
      {...rest}
    >
      <rect x="3" y="3" width="8" height="7" rx="2.2" />
      <rect x="3" y="12" width="8" height="9" rx="2.2" />
      <rect x="13" y="3" width="8" height="10" rx="2.2" />
      <rect x="13" y="15" width="8" height="6" rx="2.2" />
    </svg>
  );
}) as unknown as LucideIcon;
