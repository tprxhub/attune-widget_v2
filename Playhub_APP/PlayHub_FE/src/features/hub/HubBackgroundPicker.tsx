import { useRef, type CSSProperties } from "react";
import { HubPopover } from "./HubPopover";
import { HUB_BACKGROUNDS } from "./hubTiles";

export function HubBackgroundPicker({
  value,
  open,
  onToggle,
  onClose,
  onChange,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = HUB_BACKGROUNDS.find((item) => item.id === value) ?? HUB_BACKGROUNDS[0];
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Select Background Color"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="hub-toolbar-trigger"
        onClick={onToggle}
      >
        <span className="hidden sm:inline">Select Background Color</span>
        <span className="sm:hidden">Background</span>
        <span className="hub-background-swatch" style={{ backgroundColor: selected.color }} />
      </button>
      <HubPopover
        open={open}
        onClose={onClose}
        anchorRef={triggerRef}
        label="Background colors"
        className="hub-color-popover"
      >
        <div className="hub-color-options">
          {HUB_BACKGROUNDS.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-label={item.id + " background"}
              aria-pressed={value === item.id}
              className="hub-color-option"
              style={{ "--swatch-color": item.color } as CSSProperties}
              onClick={() => {
                onChange(item.id);
                onClose();
                triggerRef.current?.focus({ preventScroll: true });
              }}
            />
          ))}
        </div>
      </HubPopover>
    </>
  );
}
