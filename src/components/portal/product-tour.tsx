"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export interface TourStop {
  /** CSS selector for the element to spotlight — see data-tour attributes on CandidateShell's nav links. */
  target: string;
  title: string;
  body: string;
}

const TOOLTIP_WIDTH = 300;
const GAP = 12;

/** candidate-shell.tsx listens for this to open/close the mobile nav drawer for the duration of a tour — see the dispatch effect below for why. */
export const TOUR_NAV_EVENT = "lavelle:tour-nav";

/**
 * A lightweight, dependency-free spotlight/tooltip walkthrough — no
 * library, matching the rest of this codebase's hand-built components.
 *
 * The nav it points at renders twice — once in the always-in-DOM desktop
 * sidebar (CSS-hidden below the md breakpoint via "hidden md:flex", not
 * unmounted), once in the mobile drawer (only mounted while open) — both
 * copies carry the same data-tour attribute (candidate-shell.tsx). measure()
 * below picks whichever copy actually has a non-zero size instead of just
 * the first DOM match, and the TOUR_NAV_EVENT dispatch on activation tells
 * CandidateShell to open its drawer so there's a visible mobile copy to
 * find at all — without that, a mobile candidate would only ever see the
 * hidden desktop copy (zero size) and get the spotlight-less fallback for
 * every step, not just ones the drawer doesn't cover.
 */
export function ProductTour({
  steps,
  active,
  onFinish,
}: {
  steps: TourStop[];
  active: boolean;
  onFinish: () => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (active) setIndex(0);
  }, [active]);

  // Tells CandidateShell to open (and, on cleanup, close) its mobile nav
  // drawer for the duration of the tour — harmless on desktop, where the
  // drawer itself renders "flex md:hidden" regardless of open state.
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent<boolean>(TOUR_NAV_EVENT, { detail: active }));
    if (!active) return;
    return () => {
      window.dispatchEvent(new CustomEvent<boolean>(TOUR_NAV_EVENT, { detail: false }));
    };
  }, [active]);

  const step = active ? steps[index] : undefined;

  React.useEffect(() => {
    if (!step) return;

    function measure() {
      // Prefer the first VISIBLE match — the desktop sidebar copy is
      // always in the DOM (just CSS-hidden on mobile), so a plain
      // querySelector would always find that one first and report a
      // zero-size rect on mobile even once the drawer copy is open.
      const candidates = document.querySelectorAll<HTMLElement>(step!.target);
      let found: DOMRect | null = null;
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          found = r;
          break;
        }
      }
      setRect(found);
    }

    measure();
    // A beat after mount — covers a target that renders just after this
    // effect runs (the drawer opening in response to the event above is
    // its own async re-render), without needing a MutationObserver for a
    // 7/4-step tour.
    const retry = setTimeout(measure, 150);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(retry);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, index]);

  if (!mounted || !active || !step) return null;

  const isLast = index === steps.length - 1;

  function next() {
    if (isLast) onFinish();
    else setIndex((i) => i + 1);
  }
  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }

  // Clamped to the viewport width minus gaps — a narrow phone (< 324px)
  // would otherwise overflow a fixed 300px tooltip off-screen.
  const tooltipWidth = Math.min(TOOLTIP_WIDTH, window.innerWidth - GAP * 2);
  let tooltipStyle: React.CSSProperties = { position: "fixed", zIndex: 101, width: tooltipWidth };
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow > 200 ? rect.bottom + GAP : Math.max(GAP, rect.top - 200);
    const left = Math.min(Math.max(GAP, rect.left), window.innerWidth - tooltipWidth - GAP);
    tooltipStyle = { ...tooltipStyle, top, left };
  } else {
    tooltipStyle = { ...tooltipStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100]" style={{ background: rect ? "transparent" : "rgba(19,26,46,0.55)" }}>
        {rect && (
          <div
            className="absolute rounded-md transition-[top,left,width,height] duration-200 pointer-events-none"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: "0 0 0 9999px rgba(19,26,46,0.55)",
            }}
          />
        )}
      </div>

      <div style={tooltipStyle} className="rounded-lg bg-bg border border-divider shadow-lg p-4">
        <div className="text-[10px] tracking-[0.08em] uppercase text-neutral-500 mb-1">
          Step {index + 1} of {steps.length}
        </div>
        <div className="font-heading font-semibold text-[14px] mb-1">{step.title}</div>
        <p className="text-[12.5px] text-neutral-600 leading-[1.5] mb-3">{step.body}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onFinish} className="text-[12px] font-medium text-neutral-600 cursor-pointer">
            Skip tour
          </button>
          <div className="flex-1" />
          {index > 0 && (
            <Button type="button" variant="secondary" onClick={back} className="h-[30px] px-2.5 text-[12px]">
              Back
            </Button>
          )}
          <Button type="button" onClick={next} className="h-[30px] px-2.5 text-[12px]">
            {isLast ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
