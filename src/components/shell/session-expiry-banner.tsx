"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const WARN_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Session expiry warning banner.
 * Shows 15 minutes before session expiration with a live countdown timer.
 * User can dismiss (until 5 minutes remaining) or re-authenticate.
 * Re-auth via signInPath creates a new 24-hour session (no sliding renewal).
 */
export function SessionExpiryBanner({ expiresAt, signInPath }: { expiresAt: string; signInPath: string }) {
  const pathname = usePathname();
  const [showing, setShowing] = React.useState(false);
  const [timeRemaining, setTimeRemaining] = React.useState<number | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const target = new Date(expiresAt).getTime();

    function updateTimer() {
      const now = Date.now();
      const remaining = target - now;

      if (remaining <= 0) {
        // Session expired
        setShowing(false);
        setTimeRemaining(null);
      } else if (remaining <= WARN_MS) {
        // Within warning window
        setShowing(true);
        setTimeRemaining(remaining);
      } else {
        // Not yet in warning window
        setShowing(false);
        setTimeRemaining(null);
      }
    }

    updateTimer();

    // Update every second for accurate countdown
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!showing || dismissed || timeRemaining === null) return null;

  // Format time remaining
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Cannot dismiss when under 5 minutes
  const canDismiss = timeRemaining > 5 * 60 * 1000;

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-md">
      <div className="flex items-center justify-between gap-4 max-w-[1440px] mx-auto">
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-200">
              <svg className="h-4 w-4 text-amber-800" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              Your session will expire in <span className="font-mono font-semibold">{timeStr}</span>
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Sign in again to keep working. Your progress will be saved.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`${signInPath}?next=${encodeURIComponent(pathname)}`}
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 transition-colors"
          >
            Sign in again
          </a>
          {canDismiss && (
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss banner"
              className="inline-flex items-center justify-center h-6 w-6 rounded text-amber-600 hover:bg-amber-100 transition-colors"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
