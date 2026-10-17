import { type LucideIcon } from "lucide-react";
import { DashboardIcon } from "./DashboardIcon";
import { SERVICE_ICON_IMAGES, isDashboardIcon } from "./serviceIcons";
import { cn } from "@/lib/utils";

/**
 * A navigation icon on a small white tile, matching the Play Hub launcher: the illustrated icon for
 * a core service, the solid house for home, otherwise a navy line icon with a soft blue fill.
 */
export function ServiceIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  const image = SERVICE_ICON_IMAGES.get(Icon);
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgba(0,20,60,0.25)]",
        className,
      )}
    >
      {image ? (
        <img src={image} alt="" className="h-[86%] w-[86%] object-contain mix-blend-multiply" />
      ) : isDashboardIcon(Icon) ? (
        <DashboardIcon className="h-[17px] w-[17px] text-[#1f3d7a]" />
      ) : (
        <Icon className="h-[17px] w-[17px] fill-[#d4e3f7] text-[#26457f]" strokeWidth={1.9} />
      )}
    </span>
  );
}
