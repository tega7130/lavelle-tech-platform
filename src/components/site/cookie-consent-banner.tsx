"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getStoredCookieConsent, setStoredCookieConsent, type CookieConsent } from "@/lib/cookie-consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (getStoredCookieConsent() === null) setVisible(true);
  }, []);

  const choose = (value: CookieConsent) => {
    setStoredCookieConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-[var(--space-4)] sm:p-[var(--space-6)]">
      <div className="mx-auto max-w-[720px] rounded-2xl border border-divider bg-bg shadow-[0_14px_36px_rgba(19,26,46,0.14)] p-5 sm:p-[22px] flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-[13px] leading-[1.6] text-neutral-700 flex-1">
          We use strictly necessary cookies to keep you signed in and run this site. With your consent, we&rsquo;d
          also like to use analytics cookies to understand how the site is used. See our{" "}
          <Link href="/privacy" className="text-accent no-underline hover:underline">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>

        <div className="flex gap-2.5 flex-none">
          <Button variant="secondary" onClick={() => choose("necessary_only")} className="text-[13px]">
            Necessary only
          </Button>
          <Button variant="primary" onClick={() => choose("accepted")} className="text-[13px]">
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
