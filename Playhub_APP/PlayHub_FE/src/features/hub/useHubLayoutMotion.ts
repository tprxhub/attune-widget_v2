import { useEffect, useRef } from "react";

/** Animate cards from their current rectangles into the next grid layout. */
export function useHubLayoutMotion() {
  const gridRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number>(0);
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const animateLayout = (change: () => void, excludeId?: string) => {
    const cards = Array.from(
      gridRef.current?.querySelectorAll<HTMLElement>("[data-hub-card-id]") ?? [],
    ).filter((card) => card.dataset["hubCardId"] !== excludeId);
    const before = new Map(cards.map((card) => [card, card.getBoundingClientRect()]));
    cards.forEach((card) =>
      card
        .getAnimations()
        .filter((animation) => !(animation instanceof CSSAnimation))
        .forEach((animation) => animation.cancel()),
    );
    change();
    cancelAnimationFrame(frameRef.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    frameRef.current = requestAnimationFrame(() => {
      cards.forEach((card) => {
        const first = before.get(card)!;
        const last = card.getBoundingClientRect();
        if (!first.width || !last.width || !card.isConnected) return;
        const x = first.left - last.left;
        const y = first.top - last.top;
        const scaleX = first.width / last.width;
        const scaleY = first.height / last.height;
        if (Math.abs(x) + Math.abs(y) < 1 && scaleX === 1 && scaleY === 1) return;
        card.animate(
          [
            {
              transform: "translate(" + x + "px," + y + "px) scale(" + scaleX + "," + scaleY + ")",
              transformOrigin: "top left",
            },
            { transform: "none", transformOrigin: "top left" },
          ],
          { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      });
    });
  };
  return { gridRef, animateLayout };
}
