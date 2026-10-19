import { forwardRef, useId } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import progressArt from "@/assets/Icon_of_Service/Progress_tracker_TTP.png";

/**
 * The Progress icon used on the Play Hub tiles (a rising trend line), drawn in the current text
 * colour. Shaped like a Lucide icon so navigation lists can use it in place of one.
 */
export const ProgressIcon = forwardRef<SVGSVGElement, LucideProps>(function ProgressIcon(
  { className, color, size, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, ...rest },
  ref,
) {
  const maskId = useId();
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={size ?? 24}
      height={size ?? 24}
      className={className}
      aria-hidden
      {...rest}
    >
      <mask id={maskId} style={{ maskType: "alpha" }}>
        <image href={progressArt} x="-1" y="-1" width="26" height="26" />
      </mask>
      <rect width="24" height="24" fill={color ?? "currentColor"} mask={`url(#${maskId})`} />
    </svg>
  );
}) as unknown as LucideIcon;
