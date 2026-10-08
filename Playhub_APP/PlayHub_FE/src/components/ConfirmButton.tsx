import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes } from "react";
import { ModalPortal } from "./ModalPortal";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmationTitle: string;
  confirmationMessage?: string;
  confirmLabel?: string;
  requireConfirmation?: boolean;
};

/** Destructive actions run only after the user confirms; Cancel receives initial focus. */
export function ConfirmButton({
  confirmationTitle,
  confirmationMessage,
  confirmLabel = "Confirm",
  requireConfirmation = true,
  onClick,
  children,
  ...props
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => cancel.current?.focus(), 0);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!pending) {
          setOpen(false);
          trigger.current?.focus();
        }
      }
      if (event.key === "Tab") {
        const buttons = Array.from(
          dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
        );
        const first = buttons[0];
        const last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        } else if (!buttons.length) event.preventDefault();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", key, true);
    };
  }, [open, pending]);
  return (
    <>
      <button
        {...props}
        ref={trigger}
        type={props.type ?? "button"}
        onClick={(event) => {
          if (!requireConfirmation) {
            onClick?.(event);
            return;
          }
          setError("");
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-navy/45 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget && !pending) close();
            }}
          >
            <div
              ref={dialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              aria-describedby={confirmationMessage ? `${id}-message` : undefined}
              className="w-full max-w-md rounded-2xl bg-card p-6 text-navy shadow-xl"
            >
              <h2 id={`${id}-title`} className="text-xl font-bold">
                {confirmationTitle}
              </h2>
              {confirmationMessage && (
                <p id={`${id}-message`} className="mt-3 text-sm leading-relaxed text-navy/70">
                  {confirmationMessage}
                </p>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm text-coral">
                  {error}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  ref={cancel}
                  type="button"
                  disabled={pending}
                  onClick={close}
                  className="min-h-11 rounded-full border border-navy/20 px-5 text-sm font-bold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={async (event) => {
                    setPending(true);
                    setError("");
                    try {
                      await onClick?.(event);
                      close();
                    } catch (failure) {
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : "Could not complete this action. Try again.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                  className="min-h-11 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {pending ? "Please wait…" : confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
