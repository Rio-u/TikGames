import { useEffect, useRef } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

/** Loads Cloudflare's Turnstile script once, no matter how many times this is called. */
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("failed to load Turnstile"));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

/**
 * Cloudflare Turnstile CAPTCHA widget — renders nothing (and never blocks the form) when
 * VITE_TURNSTILE_SITE_KEY isn't set, mirroring the API's own TURNSTILE_SECRET_KEY dev bypass so
 * local dev works with zero CAPTCHA keys configured.
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
