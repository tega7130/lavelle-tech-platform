export type CookieConsent = "accepted" | "necessary_only";

const STORAGE_KEY = "lavelle-cookie-consent";

/** Fired on window whenever the stored consent changes, so already-mounted listeners (e.g. the analytics loader) can react without a page reload. */
export const COOKIE_CONSENT_EVENT = "lavelle:cookie-consent-changed";

export function getStoredCookieConsent(): CookieConsent | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "accepted" || stored === "necessary_only" ? stored : null;
}

export function setStoredCookieConsent(value: CookieConsent) {
  window.localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

/** Gate for any future non-essential cookie/script (e.g. analytics) — see privacy policy Section 5. */
export function hasAnalyticsConsent(): boolean {
  return getStoredCookieConsent() === "accepted";
}
