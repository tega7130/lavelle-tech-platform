"use client";

import * as React from "react";

// SSR has no window; React warns if useLayoutEffect runs there. This hook
// is only ever used by "use client" components, so the effect always does
// run on the client — this just picks the right one for the environment.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * Fires once when the element first crosses the threshold, then
 * unobserves — reveal animations should never re-trigger on scroll-back
 * (spec: stat counters "should happen only once", and the same rule
 * reads better for every other scroll reveal too).
 *
 * Above-the-fold elements are already visible at mount, so they reveal
 * synchronously (useLayoutEffect, before the browser paints) rather than
 * waiting on an IntersectionObserver's first async callback — that async
 * gap is what left hero content, the header logo, etc. visibly blank for
 * a beat after load, worst on slower devices. Anything not yet on screen
 * still falls through to the observer for a real scroll-triggered reveal.
 */
export function useInView<T extends HTMLElement>(options?: { threshold?: number; rootMargin?: string }) {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(false);
  const threshold = options?.threshold ?? 0.15;
  const rootMargin = options?.rootMargin ?? "0px 0px -60px 0px";

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < viewportHeight && rect.bottom > 0) {
      setInView(true);
      return;
    }

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
