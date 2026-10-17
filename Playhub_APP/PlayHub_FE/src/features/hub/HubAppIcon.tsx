import { type LucideIcon } from "lucide-react";
import { DashboardIcon } from "@/components/DashboardIcon";
import { SERVICE_ICON_IMAGES, isDashboardIcon } from "@/components/serviceIcons";

/**
 * The launcher's glossy icon tile, shared by app shortcuts and card headers. Every tile is white:
 * the core services use their illustrated icons, and the rest a navy icon with a soft blue fill, so
 * the whole set reads as one family.
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
  const serviceImage = SERVICE_ICON_IMAGES.get(Icon);
  return (
    <span
      aria-hidden
      className={
        "hub-app-icon " + accent + (small ? " hub-app-icon-small" : "") + " hub-app-icon-service"
      }
    >
      {serviceImage ? (
        <img src={serviceImage} alt="" className="hub-service-icon-image" />
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
