"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

// No toast/notification system exists anywhere in the app yet (every
// other flow uses an inline banner or a full status page instead — see
// blog-editor.tsx's statusNote, checkout-status.tsx). The Document
// Library candidate portal is the first flow that needs transient
// feedback for an action which doesn't navigate anywhere (favoriting),
// so this is new, but deliberately minimal: one provider, one hook, the
// same success/danger/warning tokens every other screen already uses.

export type ToastTone = "success" | "danger" | "warning";

export interface ToastOptions {
  tone?: ToastTone;
  message: string;
  /** Milliseconds before auto-dismiss. */
  durationMs?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "durationMs">> {
  id: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "bg-success-bg border-success-border text-success-text",
  danger: "bg-danger-bg border-danger-border text-danger-heading",
  warning: "bg-warning-bg border-warning-border text-warning-text",
};

const TONE_ICON: Record<ToastTone, string> = { success: "✓", danger: "✗", warning: "!" };

const DEFAULT_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(0);
  // The portal target only exists client-side — mounting it unconditionally
  // on `typeof document !== "undefined"` renders it during the very first
  // client pass (before hydration reconciles), which never matches the
  // server's HTML (server has no `document` at all) and throws a hydration
  // mismatch. Gating on a state flip inside useEffect instead means the
  // first client render matches the server (both render nothing here);
  // the portal appears only on the next, ordinary client-only render.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    ({ tone = "success", message, durationMs = DEFAULT_DURATION_MS }: ToastOptions) => {
      const id = nextId.current++;
      setToasts((cur) => [...cur, { id, tone, message }]);
      setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss]
  );

  const value = React.useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[80] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                role="status"
                className={cn(
                  "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-[13px] shadow-lg",
                  TONE_CLASSES[t.tone]
                )}
              >
                <span className="flex-none font-bold">{TONE_ICON[t.tone]}</span>
                <span className="flex-1">{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="flex-none cursor-pointer text-current opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
