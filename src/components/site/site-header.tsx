"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";
import { MenuIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { label: "Programmes", href: "/programmes" },
  { label: "How it works", href: "/#how" },
  { label: "FAQ", href: "/#faq" },
];

// A transparent, white-bordered skin for the dark hero — the shared
// `secondary` variant assumes a light surface, so its bg/border/text are
// overridden here (twMerge in buttonClassName keeps the rest: height,
// padding, radius, font).
const GHOST_ON_DARK = "bg-transparent border-white/28 text-white hover:bg-white/[0.09] hover:text-white h-[42px] px-[17px] text-[13.5px] rounded-[9px]";

export function SiteHeroHeader() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="relative z-10">
      <div className="mx-auto max-w-[1200px] flex items-center justify-between gap-4 sm:gap-8 px-5 sm:px-6 md:px-8 lg:px-10 pt-6 pb-6">
        <div className="flex items-center gap-[11px] flex-none">
          <LogoMark size={38} />
          <div>
            <div className="font-heading font-bold text-[14px] sm:text-[16px] tracking-[0.02em] text-white whitespace-nowrap">LAVELLE INSTITUTE</div>
            <div className="text-[9.5px] tracking-[0.15em] uppercase text-white/55 whitespace-nowrap">Professional Specialization</div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <nav className="hidden md:flex items-center gap-[18px] lg:gap-[26px] flex-none">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="whitespace-nowrap text-[13.5px] font-medium text-white/72 hover:text-white no-underline"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:block h-5 w-px bg-white/16" />

          <div className="hidden md:flex items-center gap-3 flex-none">
            <Link href="/sign-in" className={buttonClassName("secondary", GHOST_ON_DARK)}>
              Sign in
            </Link>
            <Link href="/register" className={cn(buttonClassName("primary"), "h-[42px] px-[19px] text-[13.5px] rounded-[9px]")}>
              Apply now
            </Link>
          </div>

          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            title="Open menu"
            className="md:hidden flex-none w-[38px] h-[38px] rounded-md border border-white/28 text-white flex items-center justify-center hover:bg-white/[0.09] cursor-pointer"
          >
            <MenuIcon />
          </button>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />

      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex md:hidden justify-end bg-[rgba(6,21,41,0.6)]" onClick={() => setMenuOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-[280px] max-w-[84vw] h-full flex flex-col p-6 text-white"
              style={{ background: "linear-gradient(158deg,#0c356f 0%,#08234a 46%,#061529 100%)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[9px]">
                  <LogoMark size={30} />
                  <div className="font-heading font-bold text-[13.5px] tracking-[0.02em]">LAVELLE</div>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="w-8 h-8 rounded-md border border-white/28 flex items-center justify-center hover:bg-white/[0.09] cursor-pointer"
                >
                  ×
                </button>
              </div>

              <nav className="flex flex-col gap-1 mt-8">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="text-[15px] font-medium text-white/85 hover:text-white no-underline py-3 border-b border-white/10"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>

              <div className="flex flex-col gap-3 mt-auto pt-8">
                <Link href="/sign-in" onClick={() => setMenuOpen(false)} className={buttonClassName("secondary", cn(GHOST_ON_DARK, "w-full justify-center"))}>
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className={cn(buttonClassName("primary"), "h-[42px] px-[19px] text-[13.5px] rounded-[9px] w-full justify-center")}
                >
                  Apply now
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}

/** The compact dark header used on the standalone programme page. */
export function SiteCompactHeader() {
  return (
    <div className="bg-[linear-gradient(158deg,#0c356f_0%,#08234a_60%,#061529_100%)]">
      <div className="mx-auto max-w-[1200px] flex items-center justify-between gap-3 sm:gap-8 px-5 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-[22px]">
        <Link href="/" className="flex items-center gap-[9px] sm:gap-[11px] no-underline min-w-0 flex-1">
          <LogoMark size={34} className="w-[30px] h-[30px] sm:w-[34px] sm:h-[34px]" />
          <div className="min-w-0">
            <div className="font-heading font-bold text-[13px] sm:text-[15px] tracking-[0.02em] text-white truncate">LAVELLE INSTITUTE</div>
            <div className="text-[9.5px] tracking-[0.15em] uppercase text-white/55 truncate">Professional Specialization</div>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 flex-none">
          <Link
            href="/programmes"
            className={buttonClassName("secondary", cn(GHOST_ON_DARK, "h-9 sm:h-10 px-2.5 sm:px-4 text-[12px] sm:text-[13px] whitespace-nowrap"))}
          >
            <span className="hidden sm:inline">All specializations</span>
            <span className="sm:hidden">Programmes</span>
          </Link>
          <Link href="/register" className={cn(buttonClassName("primary"), "h-9 sm:h-10 px-3 sm:px-[18px] text-[12px] sm:text-[13px] rounded-[9px] whitespace-nowrap")}>
            Apply now
          </Link>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
    </div>
  );
}
