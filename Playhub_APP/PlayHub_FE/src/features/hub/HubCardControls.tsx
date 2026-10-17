import { useRef } from "react";
import { ChevronDown, Minus } from "lucide-react";
import { HubPopover } from "./HubPopover";
import { HubTilePicker } from "./HubTilePicker";
import { hubCardOptionId, type HubCardSetting, type HubTileOption } from "./hubTiles";

export function HubCardControls({
  card,
  open,
  options,
  onToggle,
  onClose,
  onRemove,
  onUpdate,
  onReplace,
}: {
  card: HubCardSetting;
  open: boolean;
  options: HubTileOption[];
  onToggle: () => void;
  onClose: () => void;
  onRemove: () => void;
  onUpdate: (update: Partial<HubCardSetting>) => void;
  onReplace: (option: HubTileOption) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        type="button"
        aria-label={"Remove " + card.title + " card"}
        onClick={onRemove}
        className="hub-edit-control hub-remove-card"
      >
        <Minus aria-hidden />
      </button>
      <div className="hub-edit-control hub-card-options">
        <button
          ref={triggerRef}
          type="button"
          aria-label={"Card options for " + card.title}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={onToggle}
        >
          <ChevronDown aria-hidden />
        </button>
        <HubPopover
          open={open}
          onClose={onClose}
          anchorRef={triggerRef}
          label={"Choose tile for " + card.title}
        >
          <HubTilePicker
            title="Which tile do you want to use?"
            options={options}
            selectedId={hubCardOptionId(card)}
            onPick={(option) => {
              onReplace(option);
              triggerRef.current?.focus({ preventScroll: true });
            }}
          >
            <details className="hub-tile-settings">
              <summary>Tile settings</summary>
              <label htmlFor={"title-" + card.id}>Card title</label>
              <input
                id={"title-" + card.id}
                aria-label={card.title + " card title"}
                value={card.title}
                onChange={(event) => onUpdate({ title: event.target.value })}
              />
              <button
                type="button"
                aria-label={(card.width === "wide" ? "Make narrow " : "Make wide ") + card.title}
                onClick={() => onUpdate({ width: card.width === "wide" ? "narrow" : "wide" })}
              >
                Make {card.width === "wide" ? "narrow" : "wide"}
              </button>
            </details>
          </HubTilePicker>
        </HubPopover>
      </div>
    </>
  );
}
