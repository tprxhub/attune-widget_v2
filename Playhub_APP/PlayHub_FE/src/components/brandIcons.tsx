import { forwardRef, useId } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import accountArt from "@/assets/brand-icons/account.svg";
import askAttuneArt from "@/assets/brand-icons/ask-attune.svg";
import bilateralArt from "@/assets/brand-icons/bilateral.svg";
import dailyCheckInArt from "@/assets/brand-icons/daily-check-in.svg";
import membersArt from "@/assets/brand-icons/members.svg";
import pinchGripArt from "@/assets/brand-icons/pinch-grip.svg";
import playPlansArt from "@/assets/brand-icons/play-plans.svg";
import preWritingArt from "@/assets/brand-icons/pre-writing.svg";
import progressArt from "@/assets/brand-icons/progress.svg";
import toolUseArt from "@/assets/brand-icons/tool-use.svg";
import visualMotorArt from "@/assets/brand-icons/visual-motor.svg";

/** Marks the Play Hub brand icons, so tiles can draw them in a brand colour, not a Lucide fill. */
const BRAND = Symbol.for("playhub.brand-icon");

/**
 * A Play Hub brand icon (from the brand's "Play Hub Icons" set), drawn in the current text colour
 * so the same artwork works on cream, navy and blue. Shaped like a Lucide icon so navigation lists
 * and tiles can use it wherever they take one.
 */
function brandIcon(art: string, name: string): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(function BrandIcon(
    { className, color, size, strokeWidth: _stroke, absoluteStrokeWidth: _absolute, ...rest },
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
        data-brand-icon={name}
        aria-hidden
        {...rest}
      >
        <mask id={maskId} style={{ maskType: "alpha" }}>
          <image href={art} width="24" height="24" />
        </mask>
        <rect width="24" height="24" fill={color ?? "currentColor"} mask={`url(#${maskId})`} />
      </svg>
    );
  });
  Icon.displayName = `BrandIcon(${name})`;
  Object.assign(Icon, { [BRAND]: true });
  return Icon as unknown as LucideIcon;
}

export const isBrandIcon = (icon: unknown): boolean =>
  typeof icon === "object" && icon !== null && BRAND in icon;

// The app's core services.
export const MembersIcon = brandIcon(membersArt, "members");
export const AskAttuneIcon = brandIcon(askAttuneArt, "ask-attune");
export const ProgressBrandIcon = brandIcon(progressArt, "progress");
export const PlayPlansIcon = brandIcon(playPlansArt, "play-plans");
export const DailyCheckInIcon = brandIcon(dailyCheckInArt, "daily-check-in");
export const AccountIcon = brandIcon(accountArt, "account");

// The skill areas (Play Plan categories).
export const PinchGripIcon = brandIcon(pinchGripArt, "pinch-grip");
export const BilateralIcon = brandIcon(bilateralArt, "bilateral");
export const VisualMotorIcon = brandIcon(visualMotorArt, "visual-motor");
export const ToolUseIcon = brandIcon(toolUseArt, "tool-use");
export const PreWritingIcon = brandIcon(preWritingArt, "pre-writing");
