import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, ClipboardList, Sparkles, UserRound } from "lucide-react";
import { HubPopover } from "./HubPopover";
import { HubAppIcon } from "./HubAppIcon";
import { hubLaunchItemId } from "./hubTiles";
import type { LaunchItem } from "./hubTiles";

export function HubAppsMenu({
  items,
  paths,
  onCustomize,
}: {
  items: LaunchItem[];
  paths: { plans: string; progress: string };
  onCustomize: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const more = [
    { label: "Your Play Plans", to: paths.plans, Icon: ClipboardList },
    { label: "Your Progress", to: paths.progress, Icon: BarChart3 },
    { label: "Account", to: "/account", Icon: UserRound },
  ];
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open Apps"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="hub-apps-trigger"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="hub-nine-dots" aria-hidden>
          {Array.from({ length: 9 }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      </button>
      <HubPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        label="Apps"
        className="hub-apps-popover"
      >
        <div className="hub-nav-apps">
          <h2>Apps</h2>
          <div className="hub-picker-grid">
            {items.map((item) => (
              <Link
                key={hubLaunchItemId(item)}
                to={item.to as never}
                onClick={() => setOpen(false)}
              >
                <HubAppIcon icon={item.icon} accent={item.accent} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          <h2>More</h2>
          <div className="hub-nav-more">
            {more.map(({ label, to, Icon }) => (
              <Link key={to} to={to as never} onClick={() => setOpen(false)}>
                <Icon aria-hidden />
                {label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            className="hub-nav-customize"
            onClick={() => {
              setOpen(false);
              onCustomize();
            }}
          >
            <Sparkles aria-hidden />
            Customize Home Page
          </button>
        </div>
      </HubPopover>
    </>
  );
}
