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
      const wanted = Math.min(MAX_HEIGHT, Math.max(panelRef.current?.scrollHeight ?? 0, 96));
      const openUp = below < wanted && above > below;
      const horizontal =
        align === "right"
          ? {
              left: Math.max(
                MARGIN,
                Math.min(rect.right - width, window.innerWidth - width - MARGIN),
              ),
            }
          : { left: Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN)) };
      setStyle({
        position: "fixed",
        ...horizontal,
        maxHeight: Math.max(96, Math.min(MAX_HEIGHT, openUp ? above : below)),
        overflowY: "auto",
        ...(openUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, panelRef, align]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      style={style ?? { position: "fixed", visibility: "hidden" }}
      className={`z-[1000] ${className ?? ""}`}
    >
      {children}
    </div>,
    document.body,
  );
}
