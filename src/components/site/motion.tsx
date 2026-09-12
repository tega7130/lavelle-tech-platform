"use client";

import * as React from "react";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/cn";

/**
 * Calm, editorial hover lift for CTAs on the public marketing site.
 * Kept out of the shared Button/buttonClassName (used across admin +
 * candidate portal) so this stays scoped to the site's own motion
 * language rather than changing every button in the product.
 */
export const CTA_HOVER =
  "transition-[transform,box-shadow,color,background-color,border-color] duration-200 ease-out hover:-translate-y-[2px] active:translate-y-0 active:scale-[0.99]";

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** ms before the reveal starts, once in view — used to build a stagger. */
  delay?: number;
  /** "up" (fade + translateY, the default) or "scale" (fade + translateY + scale from 0.98). */
  variant?: "up" | "scale";
  threshold?: number;
}

/**
 * Reusable scroll-reveal wrapper: fades/slides in once when it first
 * enters the viewport (see useInView), then stays. Also doubles as the
 * on-load entrance for above-the-fold content — the IntersectionObserver
 * fires immediately for anything already in the viewport at mount, so
 * hero elements need no separate on-mount code path.
 */
export function Reveal({ children, className, delay = 0, variant = "up", threshold, ...rest }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold });
  return (
    <div
      ref={ref}
      className={cn(variant === "scale" ? "lv-reveal-scale" : "lv-reveal", inView && "lv-in", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts up from 0 to `value` once the element enters the viewport, then
 * stops for good (spec: "the count should happen only once"). Renders
 * the final value immediately under prefers-reduced-motion.
 */
export function AnimatedNumber({
  value,
  suffix = "",
  duration = 1400,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const [display, setDisplay] = React.useState(0);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;

    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
