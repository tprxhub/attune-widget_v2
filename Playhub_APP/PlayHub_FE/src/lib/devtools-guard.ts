/**
 * Discourages casual use of the browser's developer tools.
 *
 * This is a deterrent, not a security control. The page runs on the visitor's machine, so anyone
 * determined can get around it (open DevTools before the page loads, use another browser or a
 * command-line client, turn off JavaScript…). Nothing sensitive may rely on it: access to data
 * is enforced by the API, and no secret may ever be shipped in the frontend.
 *
 * What it does, only in production builds:
 *  - blocks the shortcuts for Inspect, Console, the element picker and View Source;
 *  - blocks the right-click menu, except inside form fields so copy and paste still work;
 *  - notices when DevTools is open and covers the app until it is closed.
 *
 * Open DevTools is detected with a `debugger` statement: with DevTools attached it pauses the
 * page, without it the statement costs nothing. Window-size checks are deliberately avoided,
 * because side panels, vertical tabs, zoom and mobile toolbars trigger them for ordinary people.
 *
 * Switch it off for a site (for example staging) with `VITE_ALLOW_DEVTOOLS=true`, or switch it on
 * in `vite dev` with `VITE_ENABLE_DEVTOOLS_GUARD=true`.
 */

const CHECK_INTERVAL_MS = 1500;
/** A `debugger` statement that did not pause takes microseconds; a person resuming takes longer. */
const PAUSE_THRESHOLD_MS = 200;

type KeyLike = Pick<KeyboardEvent, "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/**
 * Chrome, Edge and Firefox open DevTools with F12, Ctrl+Shift+I/J/C/K and Cmd+Option+I/J/C/K
 * (Cmd+Shift+C too) on a Mac; View Source is Ctrl+U or Cmd+Option+U. `code` is used rather than
 * `key` because Option changes the character a Mac produces.
 *
 * Ctrl+Alt is left alone on purpose: many keyboard layouts use it as AltGr to type letters.
 */
export function isDevtoolsShortcut(event: KeyLike): boolean {
  if (event.code === "F12") return true;
  if (["KeyI", "KeyJ", "KeyC", "KeyK"].includes(event.code)) {
    return (
      (event.ctrlKey && event.shiftKey && !event.altKey) ||
      (event.metaKey && (event.altKey || event.shiftKey))
    );
  }
  if (event.code === "KeyU") {
    return (event.ctrlKey && !event.shiftKey && !event.altKey) || (event.metaKey && event.altKey);
  }
  return false;
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !==
      null
  );
}

export function devtoolsGuardEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env["VITE_ALLOW_DEVTOOLS"] === "true") return false;
  return import.meta.env.PROD || import.meta.env["VITE_ENABLE_DEVTOOLS_GUARD"] === "true";
}

function devtoolsAreOpen(): boolean {
  try {
    const started = performance.now();
    // Built at run time so a minifier cannot strip the statement out.
    new Function("debugger")();
    return performance.now() - started > PAUSE_THRESHOLD_MS;
  } catch {
    // A strict Content-Security-Policy can forbid this; then there is nothing to detect with.
    return false;
  }
}

function createOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "playhub-devtools-notice";
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Developer tools are switched off");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    "gap:12px",
    "padding:24px",
    "text-align:center",
    "background:#002A64",
    "color:#FEECD4",
    "font-family:'Josefin Sans',system-ui,sans-serif",
  ].join(";");

  const title = document.createElement("p");
  title.textContent = "Developer tools are switched off";
  title.style.cssText = "margin:0;font-size:28px;font-weight:700";
  const body = document.createElement("p");
  body.textContent = "Please close them to keep using Play Hub.";
  body.style.cssText = "margin:0;font-size:16px;opacity:.8";
  overlay.append(title, body);
  return overlay;
}

/** Installs the guard and returns a function that removes it again. */
export function installDevtoolsGuard(): () => void {
  if (!devtoolsGuardEnabled()) return () => {};

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isDevtoolsShortcut(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onContextMenu = (event: MouseEvent) => {
    if (!isEditable(event.target)) event.preventDefault();
  };
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("contextmenu", onContextMenu, true);

  let overlay: HTMLElement | null = null;
  const show = () => {
    // Recreated if someone deletes it from the page while DevTools is still open.
    if (overlay?.isConnected) return;
    overlay = createOverlay();
    document.body.append(overlay);
  };
  const hide = () => {
    overlay?.remove();
    overlay = null;
  };
  const check = () => {
    if (document.hidden) return;
    if (devtoolsAreOpen()) show();
    else hide();
  };

  check();
  const timer = window.setInterval(check, CHECK_INTERVAL_MS);

  return () => {
    window.clearInterval(timer);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    hide();
  };
}
