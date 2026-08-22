"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface ScrollProgressDotsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  itemCount: number;
  itemWidth: number;
  gap: number;
}

export function ScrollProgressDots({
  containerRef,
  itemCount,
  itemWidth,
  gap,
}: ScrollProgressDotsProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleScroll() {
      const scrollLeft = (container as HTMLDivElement).scrollLeft;
      const index = Math.round(scrollLeft / (itemWidth + gap));
      setActiveIndex(Math.min(index, itemCount - 1));
    }

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, itemWidth, gap, itemCount]);

  return (
    <div className="flex justify-center gap-2 mt-6">
      {Array.from({ length: itemCount }).map((_, i) => (
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
