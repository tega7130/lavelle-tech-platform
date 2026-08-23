"use client";

import * as React from "react";
import Link from "next/link";
import { ScrollProgressDots } from "@/components/ui/scroll-progress-dots";
import { cn } from "@/lib/cn";

interface CarouselListing {
  code: string;
  tier: "FOUNDATION" | "SPECIALIST" | "ADVANCED_PRACTITIONER";
  tierLabel: string;
  title: string;
  blurb: string;
  weeks: string;
}

export function ProgrammeCarousel({ listings }: { listings: CarouselListing[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={containerRef}
        className="flex gap-[18px] mt-11 overflow-x-auto snap-x snap-mandatory pb-3 -mx-10 px-10 scrollbar-hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {listings.map((p) => (
          <Link
            key={p.code}
            href={`/programmes/${p.code}`}
            className="group block flex-none w-[300px] snap-start bg-bg border border-divider rounded-[14px] p-[26px] no-underline text-text transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(19,26,46,0.1)] hover:border-accent-200"
          >
            <div className="flex items-center justify-between gap-[14px]">
              <span
                className={cn(
                  "px-[11px] py-1 rounded-full text-[10px] font-semibold tracking-[0.05em] uppercase",
                  p.tier === "FOUNDATION"
                    ? "bg-neutral-100 text-neutral-700"
                    : "bg-accent-100 text-accent-700"
                )}
              >
                {p.tierLabel}
              </span>
              <span className="text-neutral-400 text-[17px] font-semibold transition group-hover:translate-x-1 group-hover:text-accent">
                &rarr;
              </span>
            </div>
            <h3 className="font-heading font-semibold text-[19px] leading-[1.28] mt-5">
              {p.title}
            </h3>
            <p className="text-[13px] leading-[1.62] text-neutral-600 mt-[9px] min-h-[63px]">
              {p.blurb}
            </p>
            <div className="flex gap-5 mt-5 pt-4 border-t border-dashed border-neutral-300 text-[11.5px] text-neutral-600">
              <span>{p.weeks}</span>
              <span className="ml-auto font-semibold text-accent">View programme</span>
            </div>
          </Link>
        ))}
      </div>
      <ScrollProgressDots containerRef={containerRef} itemCount={listings.length} itemWidth={300} gap={18} />
    </>
  );
}
