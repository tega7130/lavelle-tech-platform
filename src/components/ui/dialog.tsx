"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      className="absolute top-[var(--space-4)] right-[var(--space-4)] w-7 h-7 rounded-[7px] border border-divider bg-bg text-neutral-600 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
    >
      ×
    </button>
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, actions, className }: DialogProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-[var(--space-4)] bg-[rgba(19,26,46,0.45)]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative flex flex-col gap-[var(--space-3)] w-[min(460px,100%)] p-[var(--space-6)] rounded-lg bg-bg shadow-lg",
          className
        )}
      >
        <CloseButton onClose={onClose} />
        {title && <div className="font-heading font-bold text-xl pr-8">{title}</div>}
        {children && <div className="text-sm text-neutral-700">{children}</div>}
        {actions && (
          <div className="flex justify-end gap-[var(--space-2)] mt-[var(--space-2)]">{actions}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function SlideOver({ open, onClose, title, children, className }: SlideOverProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-[rgba(19,26,46,0.45)]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-[min(560px,100%)] h-full bg-bg border-l border-divider shadow-lg p-[var(--space-6)] overflow-y-auto",
          className
        )}
      >
        <CloseButton onClose={onClose} />
        {title && <div className="font-heading font-bold text-xl pr-8 mb-[var(--space-4)]">{title}</div>}
        {children}
      </div>
    </div>,
    document.body
  );
}
