import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_ID = "google-identity-services";

export function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean | undefined;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [loadError, setLoadError] = useState(false);
  const clientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;
  callback.current = onCredential;

  useEffect(() => {
    if (!clientId || disabled) return;
    const render = () => {
      if (!container.current || !window.google) return;
      container.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => callback.current(response.credential),
      });
      window.google.accounts.id.renderButton(container.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: Math.min(container.current.clientWidth || 360, 400),
      });
    };
    if (window.google) {
      render();
      return;
    }
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    script.addEventListener("error", () => setLoadError(true), { once: true });
    return () => script?.removeEventListener("load", render);
  }, [clientId, disabled]);

  if (!clientId) {
    return <p className="text-center text-xs text-navy/50">Google sign-in is not configured.</p>;
  }
  if (loadError) {
    return <p className="text-center text-xs text-coral">Google sign-in could not load.</p>;
  }
  return (
    <div
      ref={container}
      className={cn("flex w-full justify-center", disabled && "pointer-events-none opacity-50")}
    />
  );
}
