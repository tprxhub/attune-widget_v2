import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CirclePlus,
  CircleUserRound,
  CircleX,
  Layers,
  Settings,
  UserPlus,
} from "lucide-react";
import { useCapabilities, useSession } from "@/auth/session";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SignOutButton } from "@/components/SignOutButton";
import { HubAppIcon } from "./HubAppIcon";
import { HubPopover } from "./HubPopover";
import type { LaunchItem } from "./hubTiles";

export function HubCreateMenu({
  items,
  onAddTile,
}: {
  items: LaunchItem[];
  onAddTile: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { canLogAttempts, canEnrollChildren, canInviteSupporter } = useCapabilities();
  const actions = items
    .filter((item) => item.to === "/attune" || (item.to === "/check-in" && canLogAttempts))
    .map((item) => ({
      ...item,
      label: item.to === "/attune" ? "Attune Conversation" : item.label,
    }));
  if (canEnrollChildren)
    actions.push({
      label: "Member Profile",
      detail: "",
      to: "/org/enroll",
      icon: CirclePlus,
      accent: "from-sky-300 to-cyan-500",
    });
  if (canInviteSupporter)
    actions.push({
      label: "Moderator Invitation",
      detail: "",
      to: "/invite",
      icon: UserPlus,
      accent: "from-rose-300 to-pink-500",
    });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="hub-header-trigger hub-create-trigger"
        aria-label="Create New"
        title="Create New"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <CirclePlus aria-hidden />
      </button>
      <HubPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        label="Create New"
        className="hub-create-popover"
      >
        <h2>Create New</h2>
        <div className="hub-create-actions">
          {actions.map((item) => (
            <Link key={item.to} to={item.to as never} onClick={() => setOpen(false)}>
              <HubAppIcon icon={item.icon} accent={item.accent} small />
              <span>{item.label}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddTile();
            }}
          >
            <HubAppIcon icon={Layers} accent="from-slate-300 to-slate-500" small />
            <span>Home Page Tile</span>
          </button>
        </div>
      </HubPopover>
    </>
  );
}

export function HubAccountMenu({ onCustomize }: { onCustomize: () => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { session } = useSession();
  const name = session.guardianName || session.name;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="hub-header-trigger hub-account-trigger"
        aria-label="Your account"
        title="Your account"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ProfileAvatar name={name} photoUrl={session.avatarUrl} sticker={session.avatarSticker} />
      </button>
      <HubPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        label="Your account"
        className="hub-account-popover"
      >
        <h2>{name}</h2>
        <div className="hub-account-actions">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCustomize();
            }}
          >
            <Settings aria-hidden />
            <span>Play Hub Settings</span>
          </button>
          <Link to="/account" className="hub-manage-account" onClick={() => setOpen(false)}>
            <CircleUserRound aria-hidden />
            <span>
              Manage Account <ArrowUpRight aria-hidden />
            </span>
          </Link>
          <div className="hub-account-divider" />
          <SignOutButton className="hub-account-signout" icon={CircleX} />
        </div>
      </HubPopover>
    </>
  );
}
