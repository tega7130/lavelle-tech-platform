"use client";

import * as React from "react";

/**
 * Fires once when the element first crosses the threshold, then
 * unobserves — reveal animations should never re-trigger on scroll-back
 * (spec: stat counters "should happen only once", and the same rule
 * reads better for every other scroll reveal too).
 */
export function useInView<T extends HTMLElement>(options?: { threshold?: number; rootMargin?: string }) {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(false);
  const threshold = options?.threshold ?? 0.15;
  const rootMargin = options?.rootMargin ?? "0px 0px -60px 0px";

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, inView };
}
