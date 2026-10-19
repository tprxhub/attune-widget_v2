import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { HubPopover } from "./HubPopover";
import { shrinkImage } from "./shrinkImage";

export function HubWallpaperPicker({
  open,
  mode,
  customWallpaper,
  onToggle,
  onClose,
  onDefault,
  onCustom,
  onColor,
}: {
  open: boolean;
  mode: "wallpaper" | "color";
  customWallpaper: string | null;
  onToggle: () => void;
  onClose: () => void;
  onDefault: () => void;
  onCustom: (dataUrl: string) => void;
  onColor: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      onCustom(await shrinkImage(file, 1920, 1440));
      setError("");
      onClose();
    } catch (problem) {
      setError((problem as Error).message);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Choose Wallpaper"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="hub-toolbar-trigger"
        onClick={onToggle}
      >
        <span className="hidden sm:inline">Wallpaper</span>
        <ImagePlus aria-hidden className="h-5 w-5" />
      </button>
      <HubPopover open={open} onClose={onClose} anchorRef={triggerRef} label="Wallpaper options">
        <div className="hub-wallpaper-menu">
          <p>Wallpaper</p>
          <button
            type="button"
            aria-pressed={mode === "wallpaper" && !customWallpaper}
            onClick={() => {
              onDefault();
              onClose();
            }}
          >
            Brand wallpaper {mode === "wallpaper" && !customWallpaper ? "✓" : ""}
          </button>
          <label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Upload a wallpaper"
              onChange={(event) => {
                void upload(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <span>Upload a wallpaper…</span>
          </label>
          {customWallpaper && (
            <button
              type="button"
              onClick={() => {
                onDefault();
                onClose();
              }}
            >
              Reset to brand wallpaper
            </button>
          )}
          <button
            type="button"
            aria-pressed={mode === "color"}
            onClick={() => {
              onColor();
              onClose();
            }}
          >
            Use background color
          </button>
          {error && (
            <p role="alert" className="hub-wallpaper-error">
              {error}
            </p>
          )}
        </div>
      </HubPopover>
    </>
  );
}
