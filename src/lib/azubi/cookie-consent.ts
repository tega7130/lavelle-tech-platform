export type AzubiCookieConsent = "accepted" | "essential_only";

const STORAGE_KEY = "azubi-cookie-consent";
/** Bump to re-prompt every visitor after a cookie-policy change. */
const CONSENT_VERSION = "1";

/** Dispatched by the footer's "Cookie settings" link to reopen the banner. */
export const AZUBI_COOKIE_SETTINGS_EVENT = "azubi:open-cookie-settings";

function readRaw(): { value: AzubiCookieConsent; version: string } | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.value === "accepted" || parsed?.value === "essential_only") {
      return { value: parsed.value, version: String(parsed.version ?? "") };
    }
  } catch {
    // malformed/legacy value — treat as unset
  }
  return null;
}

export function getStoredAzubiCookieConsent(): AzubiCookieConsent | null {
  const raw = readRaw();
  if (!raw || raw.version !== CONSENT_VERSION) return null;
  return raw.value;
}

export function setStoredAzubiCookieConsent(value: AzubiCookieConsent) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, version: CONSENT_VERSION }));
}

/** Gate for any future non-essential cookie/script on /azubi pages. */
export function hasAzubiAnalyticsConsent(): boolean {
  return getStoredAzubiCookieConsent() === "accepted";
}
