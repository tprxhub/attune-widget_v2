import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

interface FloatingPanelProps {
  /** The trigger the panel hangs off. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Lets the owner treat clicks inside the (portalled) panel as "inside" for click-outside logic. */
  panelRef: RefObject<HTMLDivElement | null>;
  align?: "left" | "right";
  className?: string;
  maxHeight?: number;
  overflow?: "auto" | "visible";
  children: ReactNode;
}

const GAP = 8;
const MARGIN = 12;
const MAX_HEIGHT = 320;

/**
 * Dropdown surface rendered in <body> with fixed positioning. A card or modal with its own
 * overflow can't clip it, and it opens upward when there is more room above the trigger.
 */
export function FloatingPanel({
  anchorRef,
  panelRef,
  align = "left",
  className,
  maxHeight = MAX_HEIGHT,
  overflow = "auto",
  children,
}: FloatingPanelProps) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = panelRef.current?.offsetWidth ?? 0;
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const wanted = Math.min(maxHeight, Math.max(panelRef.current?.scrollHeight ?? 0, 96));
      const openUp = below < wanted && above > below;
      const left = Math.max(
        MARGIN,
        Math.min(
          align === "right" ? rect.right - width : rect.left,
          window.innerWidth - width - MARGIN,
        ),
      );
      const placement: CSSProperties & { "--floating-anchor-x": number } = {
        position: "fixed",
        left,
        "--floating-anchor-x": rect.left + rect.width / 2 - left,
        maxWidth: window.innerWidth - MARGIN * 2,
        maxHeight: Math.max(96, Math.min(maxHeight, openUp ? above : below)),
        overflowY: overflow,
        ...(openUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      };
      setStyle(placement);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, panelRef, align, maxHeight, overflow]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      data-side={style?.bottom !== undefined ? "top" : "bottom"}
      style={style ?? { position: "fixed", visibility: "hidden" }}
      className={`z-[1000] ${className ?? ""}`}
    >
      {children}
    </div>,
    document.body,
  );
}
