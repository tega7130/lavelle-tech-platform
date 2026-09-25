"use client";

import * as React from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// v3 tokens are valid for 2 minutes — refreshed well before that so a
// slow form fill never submits an expired one.
const REFRESH_MS = 90_000;

/**
 * Keeps a fresh v3 token ready for `action`, refreshed on an interval —
 * hand the returned value to a hidden form field
 * (<input type="hidden" name="recaptchaToken" value={token} />) so it's
 * already valid whenever the candidate actually submits. Returns "" until
 * the first token resolves, or permanently if NEXT_PUBLIC_RECAPTCHA_SITE_KEY
 * isn't set — verifyRecaptcha() on the server treats an empty token as
 * "fail closed" only when it's itself configured, so an unconfigured
 * client+server pair is simply unprotected, not broken.
 */
export function useRecaptchaToken(action: string): string {
  const [token, setToken] = React.useState("");
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  React.useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    async function refresh() {
      try {
        await loadRecaptchaScript(siteKey!);
        window.grecaptcha!.ready(() => {
          window.grecaptcha!
            .execute(siteKey!, { action })
            .then((t) => {
              if (!cancelled) setToken(t);
            })
            .catch((error) => console.error("reCAPTCHA execute failed:", error));
        });
      } catch (error) {
        console.error("reCAPTCHA script load failed:", error);
      }
    }

    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [siteKey, action]);

  return token;
}
