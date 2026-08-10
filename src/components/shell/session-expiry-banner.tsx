"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const WARN_MS = 15 * 60 * 1000;

/**
 * README H3 rule 5: a quiet notice at fifteen minutes remaining, with a
 * Stay signed in action. That action re-authenticates — a fresh sign-in
 * starts a brand new 24-hour session — rather than silently extending
 * the current one, which is the exact sliding-renewal this policy rules
 * out (rule 1).
 */
export function SessionExpiryBanner({ expiresAt, signInPath }: { expiresAt: Date; signInPath: string }) {
  const pathname = usePathname();
  const [showing, setShowing] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const target = new Date(expiresAt).getTime();
    function check() {
      setShowing(target - Date.now() <= WARN_MS);
    }
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!showing || dismissed) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-between gap-3 px-[var(--space-6)] py-2.5 bg-[#fff7e6] border-b border-[#f0d9a8] text-[12.5px] text-[#7a4d06] shadow-md">
      <span>Your session ends soon. Sign in again to keep working without losing your place.</span>
      <div className="flex items-center gap-3 flex-none">
        <a href={`${signInPath}?next=${encodeURIComponent(pathname)}`} className="font-semibold text-[#7a4d06] hover:underline">
          Stay signed in
        </a>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-[#7a4d06] cursor-pointer">
          ×
        </button>
      </div>
    </div>
  );
}
