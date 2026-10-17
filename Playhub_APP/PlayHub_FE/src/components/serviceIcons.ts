import {
  BarChart3,
  CalendarCheck,
  FolderClosed,
  House,
  LayoutGrid,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import attuneIcon from "@/assets/Icon_of_Service/Attune_icon.png";
import checkInIcon from "@/assets/Icon_of_Service/Daily Check in.png";
import plansIcon from "@/assets/Icon_of_Service/Game_Plan_TTP.png";
import progressIcon from "@/assets/Icon_of_Service/Progress_tracker_TTP.png";
import { DashboardIcon } from "./DashboardIcon";

/** The core services' illustrated icons, shared by the sidebar and the Play Hub launcher. */
export const SERVICE_ICON_IMAGES = new Map<LucideIcon, string>([
  [FolderClosed, plansIcon],
  [LayoutGrid, plansIcon],
  [CalendarCheck, checkInIcon],
  [BarChart3, progressIcon],
  [Sparkles, attuneIcon],
]);

/** Whether an icon stands for the Dashboard (older lists still pass Lucide's house). */
export const isDashboardIcon = (icon: LucideIcon) => icon === DashboardIcon || icon === House;
