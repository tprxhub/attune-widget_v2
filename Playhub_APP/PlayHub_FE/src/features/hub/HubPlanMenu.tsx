import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Ellipsis, FileText, FolderClosed } from "lucide-react";
import type { Level } from "@/lib/types";
import { HubPopover } from "./HubPopover";

const VIEWS = [
  { value: "all", label: "All Play Plans", icon: FolderClosed },
  { value: "Rookie", label: "Rookie dose", icon: FileText },
  { value: "Starter", label: "Starter dose", icon: FileText },
  { value: "Pro", label: "Pro dose", icon: FileText },
] as const;

export function HubPlanMenu({
  title,
  value,
  onChange,
  to,
}: {
  title: string;
  value: Level | "all";
  onChange: (value: Level | "all") => void;
  to: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="hub-plan-toolbar">
      <button
        ref={triggerRef}
        type="button"
        className="hub-plan-more"
        aria-label={title + " display options"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Ellipsis aria-hidden />
      </button>
      <HubPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        label={"Show " + title}
        className="hub-plan-popover"
        align="left"
      >
        <div className="hub-plan-views">
          <h3>Show</h3>
          <div role="group" aria-label="Play Plans shown">
            {VIEWS.map(({ value: view, label, icon: Icon }) => (
              <label key={view}>
                <input
                  type="radio"
                  name={"hub-plan-view-" + title}
                  checked={view === value}
                  onChange={() => {
                    onChange(view);
                    setOpen(false);
                    triggerRef.current?.focus({ preventScroll: true });
                  }}
                />
                <Icon aria-hidden />
                {label}
              </label>
            ))}
          </div>
          <Link to={to as never} aria-label="Browse all Play Plans">
            All Play Plans <ArrowRight aria-hidden />
          </Link>
        </div>
      </HubPopover>
    </div>
  );
}
