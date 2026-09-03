"use client";

import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/cn";

interface TierCardProps {
  index: number;
  border: string;
  stripe: string;
  sealBg: string;
  sealColor: string;
  seal: string;
  step: string;
  name: string;
  blurb: string;
  facts: readonly (readonly [string, string])[];
}

/**
 * A single ladder card. Its own useInView (rather than the generic Reveal)
 * so the card's fade/rise and its top stripe's left-to-right fill share
 * one trigger — reinforcing "a journey that builds" per level, staggered
 * across the three cards.
 */
export function TierCard({ index, border, stripe, sealBg, sealColor, seal, step, name, blurb, facts }: TierCardProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const delay = index * 110;

  return (
    <div
      ref={ref}
      className={cn(
        "lv-reveal relative rounded-[14px] overflow-hidden bg-bg border transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(19,26,46,0.1)]",
        inView && "lv-in",
        border
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={cn("lv-stripe h-1", inView && "lv-in", stripe)} style={{ transitionDelay: `${delay + 220}ms` }} />
      <div className="p-[30px] pb-7">
        <div className="flex items-start justify-between gap-4">
          <span className={cn("w-[46px] h-[46px] flex-none rounded-xl flex items-center justify-center font-heading font-bold text-[18px]", sealBg, sealColor)}>{seal}</span>
          <span className="flex-none px-[10px] py-1 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-semibold tracking-[0.06em] uppercase">{step}</span>
        </div>
        <h3 className="font-heading font-semibold text-[21px] mt-[22px]">{name}</h3>
        <p className="text-[13.5px] leading-[1.65] text-neutral-600 mt-[10px] min-h-[66px]">{blurb}</p>
        <div className="flex flex-col gap-[9px] mt-5 pt-[18px] border-t border-dashed border-neutral-300">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-[14px] text-[12.5px]">
              <span className="text-neutral-600">{label}</span>
              <span className="font-medium text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
