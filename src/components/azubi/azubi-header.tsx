"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { AzubiWordmark } from "./azubi-wordmark";
import { AzubiButton } from "./azubi-button";
import { AZUBI_MENU_LINKS } from "./azubi-nav";

function MenuGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h16M3 11h16M3 16h16" />
    </svg>
  );
}

function isCurrent(pathname: string, href: string) {
  const [path] = href.split(/[?#]/);
  return pathname === path;
}

export function AzubiHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const wasOpen = React.useRef(false);

  const close = React.useCallback(() => setOpen(false), []);

  // Route change closes the panel (e.g. a same-page hash link).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Escape key + outside click.
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  // Focus returns to the toggle button whenever the panel closes (not on first mount).
  React.useEffect(() => {
    if (wasOpen.current && !open) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <header className="relative z-20 bg-azubi-mist">
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 md:px-8 lg:px-12 py-3 sm:py-4 flex items-center justify-between gap-3">
        <AzubiWordmark />
        <div className="flex items-center gap-2 sm:gap-3">
          <AzubiButton href="/azubi/apply" className="min-h-[44px] sm:min-h-[48px] px-[14px] sm:pl-[22px] sm:pr-[10px] text-[15px] sm:text-[17px]">
            <span className="sm:hidden">Apply</span>
            <span className="hidden sm:inline">Apply as a fellow</span>
          </AzubiButton>
          <button
            ref={buttonRef}
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="azubi-menu-panel"
            onClick={() => setOpen((v) => !v)}
            className="w-11 h-11 rounded-[12px] border-2 border-azubi-green-900 text-azubi-green-900 flex items-center justify-center cursor-pointer hover:bg-azubi-mint data-[open=true]:bg-azubi-mint"
            data-open={open}
          >
            <MenuGlyph />
          </button>
        </div>
      </div>

      {open && (
        <div
          id="azubi-menu-panel"
          ref={panelRef}
          role="region"
          aria-label="Azubi Foundation menu"
          className="absolute right-4 sm:right-6 md:right-8 lg:right-12 top-[calc(100%+10px)] w-[min(300px,calc(100vw-2rem))] bg-white border-2 border-azubi-mint rounded-[20px] p-[10px] flex flex-col shadow-[0_12px_32px_rgba(15,58,48,0.14)] z-30"
        >
          {AZUBI_MENU_LINKS.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={close}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "px-[14px] py-[14px] rounded-[12px] font-bold text-[17px] no-underline text-azubi-green-900 hover:bg-azubi-mint",
                  current && "bg-azubi-mint"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
