import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { FloatingPanel } from "@/components/FloatingPanel";

/** Shared, unclipped Hub popover with outside-click and Escape dismissal. */
export function HubPopover({
  open,
  onClose,
  anchorRef,
  label,
  className = "",
  align = "right",
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLButtonElement | null>;
  label: string;
  className?: string;
  align?: "left" | "right";
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const focusFrame = requestAnimationFrame(() =>
      panelRef.current
        ?.querySelector<HTMLElement>("button:not(:disabled), a[href], input, select, summary")
        ?.focus({ preventScroll: true }),
    );
    const outside = (event: globalThis.PointerEvent) => {
      const node = event.target as Node;
      if (node instanceof Element && node.closest('[aria-modal="true"]')) return;
      if (!anchorRef.current?.contains(node) && !panelRef.current?.contains(node))
        closeRef.current();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeRef.current();
      anchorRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, anchorRef]);
  if (!open) return null;
  return (
    <FloatingPanel
      anchorRef={anchorRef}
      panelRef={panelRef}
      align={align}
      maxHeight={600}
      overflow="visible"
      className={"hub-popover " + className}
    >
      <div className="hub-popover-content" role="dialog" aria-label={label}>
        {children}
      </div>
    </FloatingPanel>
  );
}
