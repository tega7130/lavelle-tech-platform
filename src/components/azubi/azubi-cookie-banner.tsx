"use client";

import * as React from "react";
import Link from "next/link";
import {
  AZUBI_COOKIE_SETTINGS_EVENT,
  getStoredAzubiCookieConsent,
  setStoredAzubiCookieConsent,
  type AzubiCookieConsent,
} from "@/lib/azubi/cookie-consent";

/**
 * No non-essential cookies/scripts load before "Accept all" — this banner
 * is the only thing allowed to run before consent, and today there's
 * nothing non-essential behind it (see AZUBI_BUILD_BRIEF section 8).
 */
export function AzubiCookieBanner() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getStoredAzubiCookieConsent() === null) setVisible(true);

    function onOpenSettings() {
      setVisible(true);
    }
    window.addEventListener(AZUBI_COOKIE_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(AZUBI_COOKIE_SETTINGS_EVENT, onOpenSettings);
  }, []);

  const choose = (value: AzubiCookieConsent) => {
    setStoredAzubiCookieConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 sm:p-6" role="region" aria-label="Cookie notice">
      <div className="mx-auto max-w-[480px] bg-white border-2 border-azubi-mint rounded-[24px] p-[22px] shadow-[0_16px_44px_rgba(15,58,48,0.18)] flex flex-col gap-[14px]">
        <span className="inline-flex items-center gap-[10px] font-azubi font-bold text-[13px] tracking-[0.16em] uppercase text-azubi-green-900">
          <i aria-hidden="true" className="w-[12px] h-[12px] rounded-[4px] bg-azubi-apricot block" />
          Cookies
        </span>
        <p className="text-[17px] leading-[1.6] text-azubi-ink">
          We use essential cookies to keep this site working. With your permission, we may also use optional cookies
          to understand how it is used. Read our{" "}
          <Link href="/azubi/privacy#cookies" className="text-azubi-green-700 underline">
            Privacy notice
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-[10px]">
          <button
            type="button"
            onClick={() => choose("essential_only")}
            className="inline-flex items-center justify-center min-h-[48px] px-[22px] rounded-[12px] font-azubi font-bold text-[17px] border-2 border-azubi-green-900 text-azubi-green-900 bg-transparent hover:bg-azubi-mint cursor-pointer"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="inline-flex items-center justify-center min-h-[48px] px-[22px] rounded-[12px] font-azubi font-bold text-[17px] border-2 border-azubi-green-900 bg-azubi-green-900 text-white hover:bg-azubi-green-700 hover:border-azubi-green-700 cursor-pointer"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

export function AzubiCookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(AZUBI_COOKIE_SETTINGS_EVENT))}
      className="text-left bg-transparent border-0 p-0 py-[6px] text-[17px] font-[inherit] text-white no-underline hover:underline cursor-pointer"
    >
      Cookie settings
    </button>
  );
}
