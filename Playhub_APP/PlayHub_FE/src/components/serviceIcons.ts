import { House, type LucideIcon } from "lucide-react";
import { DashboardIcon } from "./DashboardIcon";

/** Whether an icon stands for the Dashboard (older lists still pass Lucide's house). */
export const isDashboardIcon = (icon: LucideIcon) => icon === DashboardIcon || icon === House;
