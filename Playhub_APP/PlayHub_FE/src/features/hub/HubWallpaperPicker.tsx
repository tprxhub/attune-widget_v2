import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { HubPopover } from "./HubPopover";

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
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 15_000_000) {
      setError("Choose a PNG, JPEG, or WebP image under 15 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1920 / bitmap.width, 1440 / bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image processing is unavailable.");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setError("");
      onCustom(canvas.toDataURL("image/jpeg", 0.78));
      onClose();
    } catch {
      setError("This image could not be opened. Try another file.");
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
