import { type LucideIcon } from "lucide-react";
import { DashboardIcon } from "@/components/DashboardIcon";
import { isBrandIcon } from "@/components/brandIcons";
import { isDashboardIcon } from "@/components/serviceIcons";

/**
 * The launcher's glossy icon tile, shared by app shortcuts and card headers. Every tile is white:
 * the core services use the Play Hub brand icons in brand navy, and the rest a navy icon with a soft
 * blue fill, so the whole set reads as one family.
 */
export function HubAppIcon({
  icon: Icon,
  accent = "from-sky-300 to-blue-500",
  small = false,
}: {
  icon: LucideIcon;
  accent?: string;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={
        "hub-app-icon " + accent + (small ? " hub-app-icon-small" : "") + " hub-app-icon-service"
      }
    >
      {isBrandIcon(Icon) ? (
        <Icon className="hub-icon-symbol hub-icon-brand" />
      ) : isDashboardIcon(Icon) ? (
        <DashboardIcon className="hub-icon-symbol hub-icon-dashboard" />
      ) : (
        <Icon className="hub-icon-symbol hub-icon-filled" strokeWidth={1.8} />
      )}
    </span>
  );
}

export function HubCardHeader({
  title,
  subtitle,
  icon,
  accent,
  subtitleIcon: SubtitleIcon,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
  subtitleIcon?: LucideIcon;
}) {
  return (
    <div className="hub-card-header">
      <HubAppIcon icon={icon} accent={accent} small />
      <div className="min-w-0">
        <h2>{title}</h2>
        <p>
          {SubtitleIcon && (
            <span className="hub-subtitle-icon">
              <SubtitleIcon aria-hidden />
            </span>
          )}
          {subtitle}
        </p>
      </div>
    </div>
  );
}
