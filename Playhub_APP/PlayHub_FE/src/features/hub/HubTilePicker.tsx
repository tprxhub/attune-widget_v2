import type { ReactNode } from "react";
import { HubAppIcon } from "./HubAppIcon";
import type { HubTileOption } from "./hubTiles";

export function HubTilePicker({
  title,
  options,
  selectedId,
  onPick,
  children,
}: {
  title: string;
  options: HubTileOption[];
  selectedId?: string;
  onPick: (option: HubTileOption) => void;
  children?: ReactNode;
}) {
  return (
    <div className="hub-tile-picker">
      <h2>{title}</h2>
      <div className="hub-picker-grid">
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            disabled={option.id === selectedId}
            aria-label={option.title}
            aria-pressed={option.id === selectedId}
            onClick={() => onPick(option)}
          >
            <HubAppIcon icon={option.icon} accent={option.accent} />
            <span>{option.title}</span>
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
