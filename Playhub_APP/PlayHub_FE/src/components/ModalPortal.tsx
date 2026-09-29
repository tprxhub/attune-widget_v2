import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders overlay content directly into <body> so ancestors with transform,
 * filter or backdrop-blur can't trap a `fixed` overlay inside their own box.
 * Also locks background scroll while open.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
