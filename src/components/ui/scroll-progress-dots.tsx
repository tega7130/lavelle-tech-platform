"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface ScrollProgressDotsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  itemCount: number;
  itemWidth: number;
  gap: number;
  dotCount?: number;
}

export function ScrollProgressDots({
  containerRef,
  itemCount,
  itemWidth,
  gap,
  dotCount = 3,
}: ScrollProgressDotsProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleScroll() {
      const div = container as HTMLDivElement;
      const scrollLeft = div.scrollLeft;
      const maxScroll = div.scrollWidth - div.clientWidth;

      if (maxScroll <= 0) {
        setActiveIndex(0);
        return;
      }

      const scrollPercent = scrollLeft / maxScroll;
      const pageIndex = Math.floor(scrollPercent * dotCount);
      setActiveIndex(Math.min(pageIndex, dotCount - 1));
    }

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, itemWidth, gap, dotCount]);

  return (
    <div className="flex justify-center gap-2 mt-6">
      {Array.from({ length: dotCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full transition-all",
            i === activeIndex ? "bg-accent w-6" : "bg-neutral-300"
          )}
        />
      ))}
    </div>
  );
}
