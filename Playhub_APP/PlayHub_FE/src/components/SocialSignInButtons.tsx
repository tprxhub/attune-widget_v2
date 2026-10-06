import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { SocialProvider } from "@/api/client";
import { GoogleSignInButton } from "./GoogleSignInButton";

/** What a provider hands back: an ID token for our API, plus Apple's one-time name. */
export interface SocialCredential {
  provider: SocialProvider;
  credential: string;
  name?: string | undefined;
}

const env = (key: string) => (import.meta.env[key] as string | undefined) || undefined;
const GOOGLE_CLIENT_ID = env("VITE_GOOGLE_CLIENT_ID");
const APPLE_CLIENT_ID = env("VITE_APPLE_CLIENT_ID");
const MICROSOFT_CLIENT_ID = env("VITE_MICROSOFT_CLIENT_ID");

/** True when at least one provider is configured, so the "or" divider is worth showing. */
export const socialSignInEnabled = Boolean(
  GOOGLE_CLIENT_ID || APPLE_CLIENT_ID || MICROSOFT_CLIENT_ID,
);

/** Popups the person closed themselves are not errors worth showing. */
function wasCancelled(reason: unknown) {
  const text = String(
    (reason as { error?: string; errorCode?: string })?.error ??
      (reason as { errorCode?: string })?.errorCode ??
      reason,
  );
  return /popup_closed|user_cancelled|user_cancel|cancelled/i.test(text);
}

// ── Apple ────────────────────────────────────────────────────────────────────────────────────

interface AppleSignInResponse {
  authorization: { id_token: string };
  user?: { name?: { firstName?: string; lastName?: string } };
}

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (options: Record<string, unknown>) => void;
        signIn: () => Promise<AppleSignInResponse>;
      };
    };
  }
}

const APPLE_SCRIPT =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset["loaded"]) return resolve();
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => {
      script.dataset["loaded"] = "1";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error("Sign-in could not load.")));
    if (!existing) {
      script.id = id;
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

async function signInWithApple(): Promise<SocialCredential> {
  await loadScript("apple-sign-in", APPLE_SCRIPT);
  window.AppleID!.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: "name email",
    // Must exactly match a Return URL on the Services ID in the Apple Developer portal.
    redirectURI: env("VITE_APPLE_REDIRECT_URI") ?? `${window.location.origin}/login`,
    usePopup: true,
  });
  const response = await window.AppleID!.auth.signIn();
  const name = [response.user?.name?.firstName, response.user?.name?.lastName]
    .filter(Boolean)
    .join(" ");
  return {
    provider: "apple",
    credential: response.authorization.id_token,
    name: name || undefined,
  };
}

// ── Microsoft ────────────────────────────────────────────────────────────────────────────────

let msalApp: Promise<import("@azure/msal-browser").IPublicClientApplication> | null = null;

async function signInWithMicrosoft(): Promise<SocialCredential> {
  msalApp ??= import("@azure/msal-browser").then(({ createStandardPublicClientApplication }) =>
    createStandardPublicClientApplication({
      auth: {
        clientId: MICROSOFT_CLIENT_ID!,
        // "common" lets both personal (Outlook.com, Hotmail) and work or school accounts in.
        authority: "https://login.microsoftonline.com/common",
        redirectUri: `${window.location.origin}/auth/microsoft-callback`,
      },
      cache: { cacheLocation: "sessionStorage" },
    }),
  );
  const app = await msalApp;
  const result = await app.loginPopup({
    scopes: ["openid", "profile", "email"],
    prompt: "select_account",
  });
  return { provider: "microsoft", credential: result.idToken, name: result.account?.name };
}

// ── Buttons ──────────────────────────────────────────────────────────────────────────────────

const pill =
  "flex min-h-11 w-full max-w-[400px] items-center justify-center gap-2.5 rounded-full px-5 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50";

function AppleLogo() {
  return (
    <svg viewBox="0 0 17 20" className="h-[18px] w-[18px]" aria-hidden fill="currentColor">
      <path d="M14.06 10.62c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.66-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.31-.89-2.32-3.54ZM11.86 4.13c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.58-2.57 1.32-.56.65-1.06 1.7-.92 2.7.98.08 1.98-.5 2.58-1.24Z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="h-[18px] w-[18px]" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/**
 * Google, Apple (iCloud) and Microsoft (Outlook, Hotmail, work or school) sign-in. Each button
 * appears only when its client ID is set, and returns an ID token for the API to verify.
 */
export function SocialSignInButtons({
  onCredential,
  onError,
  disabled,
}: {
  onCredential: (credential: SocialCredential) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const run = async (provider: SocialProvider, start: () => Promise<SocialCredential>) => {
    setBusy(provider);
    try {
      onCredential(await start());
    } catch (reason) {
      if (!wasCancelled(reason)) {
        const label = provider === "apple" ? "Apple" : "Microsoft";
        onError?.(`${label} sign-in didn’t finish. Please try again.`);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      {GOOGLE_CLIENT_ID && (
        <GoogleSignInButton
          onCredential={(credential) => onCredential({ provider: "google", credential })}
          disabled={disabled}
        />
      )}
      {APPLE_CLIENT_ID && (
        <button
          type="button"
          onClick={() => run("apple", signInWithApple)}
          disabled={disabled || busy !== null}
          className={`${pill} bg-black text-white hover:bg-black/85`}
        >
          {busy === "apple" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <AppleLogo />
          )}
          Sign in with Apple
        </button>
      )}
      {MICROSOFT_CLIENT_ID && (
        <button
          type="button"
          onClick={() => run("microsoft", signInWithMicrosoft)}
          disabled={disabled || busy !== null}
          className={`${pill} border border-[#8C8C8C] bg-white text-[#5E5E5E] hover:bg-[#F3F3F3]`}
        >
          {busy === "microsoft" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <MicrosoftLogo />
          )}
          Sign in with Microsoft
        </button>
      )}
    </div>
  );
}
