import { useEffect, useRef, useState, type PointerEvent } from "react";

interface HubDragActions {
  onPreview: (sourceId: string, targetId: string) => void;
  onDrop: (sourceId: string, targetId: string) => void;
  onCancel: () => void;
}

export function useHubCardDrag() {
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragOrigin, setDragOrigin] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const startCardDrag = (id: string, event: PointerEvent<HTMLElement>, actions: HubDragActions) => {
    const target = event.target as HTMLElement;
    if (id === "profile" || event.button !== 0 || target.closest("button,input,select,label"))
      return;
    if (cleanupRef.current) return;
    const source = event.currentTarget;
    const grid = source.parentElement!;
    const slotIds = Array.from(
      grid.querySelectorAll<HTMLElement>('[data-hub-card-id]:not([data-hub-card-id="profile"])'),
    )
      .sort((a, b) => Number(a.style.order) - Number(b.style.order))
      .map((card) => card.dataset["hubCardId"]!);
    const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY, scrollY: window.scrollY };
    let pointer = { x: event.clientX, y: event.clientY };
    let started = false;
    let scrollFrame = 0;
    let previewTarget = id;

    const targetAt = () => {
      const slots = Array.from(
        grid.querySelectorAll<HTMLElement>(
          '[data-hub-card-id]:not([data-hub-card-id="profile"]):not([data-dragging="true"]), .hub-drag-placeholder',
        ),
      ).sort((a, b) => Number(a.style.order) - Number(b.style.order));
      const index = slots.findIndex((slot) => {
        const bounds = slot.getBoundingClientRect();
        return (
          pointer.x >= bounds.left &&
          pointer.x <= bounds.right &&
          pointer.y >= bounds.top &&
          pointer.y <= bounds.bottom
        );
      });
      return slotIds[index];
    };
    const updatePosition = () => {
      setDragOffset({
        x: pointer.x - start.x,
        y: pointer.y - start.y + window.scrollY - start.scrollY,
      });
      const destination = targetAt();
      setDragOverCardId(destination ?? null);
      if (destination && destination !== previewTarget) {
        previewTarget = destination;
        actions.onPreview(id, destination);
      }
    };
    const autoScroll = () => {
      const edge =
        pointer.y < 150
          ? pointer.y - 150
          : pointer.y > window.innerHeight - 80
            ? pointer.y - window.innerHeight + 80
            : 0;
      if (edge) {
        window.scrollBy(0, Math.max(-16, Math.min(16, edge / 5)));
        updatePosition();
      }
      scrollFrame = requestAnimationFrame(autoScroll);
    };
    const clearDrag = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setDraggingCardId(null);
      setDragOverCardId(null);
      setDragOffset({ x: 0, y: 0 });
      setDragOrigin(null);
    };
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      pointer = { x: moveEvent.clientX, y: moveEvent.clientY };
      if (!started && Math.hypot(pointer.x - start.x, pointer.y - start.y) < 6) return;
      if (!started) {
        started = true;
        source
          .getAnimations()
          .filter((animation) => !(animation instanceof CSSAnimation))
          .forEach((animation) => animation.cancel());
        setDragOrigin({
          left: source.offsetLeft,
          top: source.offsetTop,
          width: source.offsetWidth,
          height: source.offsetHeight,
        });
        setDraggingCardId(id);
        scrollFrame = requestAnimationFrame(autoScroll);
      }
      moveEvent.preventDefault();
      window.getSelection()?.removeAllRanges();
      updatePosition();
    };
    const onUp = (upEvent: globalThis.PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      pointer = { x: upEvent.clientX, y: upEvent.clientY };
      const destination = targetAt();
      if (started) {
        if (destination) actions.onDrop(id, destination);
        else actions.onCancel();
      }
      clearDrag();
    };
    const cancelDrag = () => {
      if (started) actions.onCancel();
      clearDrag();
    };
    const onCancel = (cancelEvent: globalThis.PointerEvent) => {
      if (cancelEvent.pointerId === pointerId) cancelDrag();
    };
    const onKeyDown = (keyEvent: globalThis.KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      cancelDrag();
    };
    const onScroll = () => {
      if (started) updatePosition();
    };
    cleanupRef.current = () => {
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", cancelDrag);
      window.removeEventListener("resize", cancelDrag);
      window.removeEventListener("scroll", onScroll);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", cancelDrag);
    window.addEventListener("resize", cancelDrag);
    window.addEventListener("scroll", onScroll);
  };
  return { draggingCardId, dragOverCardId, dragOffset, dragOrigin, startCardDrag };
}
