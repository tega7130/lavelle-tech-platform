"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Listing = {
  code: string;
  title: string;
  blurb: string;
  tier: "FOUNDATION" | "SPECIALIST" | "ADVANCED_PRACTITIONER";
  tierLabel: string;
  weeks: string;
  credits: string;
  fee: string;
};

const TIER_FILTERS = [
  { value: "ALL", label: "All tiers" },
  { value: "FOUNDATION", label: "Foundation" },
  { value: "SPECIALIST", label: "Specialist" },
  { value: "ADVANCED_PRACTITIONER", label: "Advanced Practitioner" },
] as const;

export function ProgrammeCatalogue({ listings }: { listings: Listing[] }) {
  const [query, setQuery] = React.useState("");
  const [tier, setTier] = React.useState<(typeof TIER_FILTERS)[number]["value"]>("ALL");

  const filtered = listings.filter((p) => {
    const matchesTier = tier === "ALL" || p.tier === tier;
    const matchesQuery = query.trim().length === 0 || p.title.toLowerCase().includes(query.trim().toLowerCase()) || p.blurb.toLowerCase().includes(query.trim().toLowerCase());
    return matchesTier && matchesQuery;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TIER_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTier(f.value)}
              className={cn(
                "px-[14px] py-2 rounded-full text-[12.5px] font-semibold border transition cursor-pointer",
                tier === f.value ? "bg-accent border-accent text-accent-2" : "bg-bg border-divider text-neutral-700 hover:border-accent-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-[280px]">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
            <circle cx="7" cy="7" r="5.2" />
            <path d="M11 11 14.5 14.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search programmes"
            className="w-full h-10 pl-9 pr-3 rounded-[9px] border border-divider bg-bg text-[13px] outline-none focus:border-accent-200"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 mt-10 border border-divider rounded-[14px] bg-neutral-100">
          <div className="font-heading font-semibold text-[16px]">No programmes match your search</div>
          <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">Try a different keyword or clear the tier filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px] mt-10">
          {filtered.map((p) => (
            <Link
              key={p.code}
              href={`/programmes/${p.code}`}
              className="group block bg-bg border border-divider rounded-[14px] p-[26px] no-underline text-text transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(19,26,46,0.1)] hover:border-accent-200"
            >
              <div className="flex items-center justify-between gap-[14px]">
                <span className={cn("px-[11px] py-1 rounded-full text-[10px] font-semibold tracking-[0.05em] uppercase", p.tier === "FOUNDATION" ? "bg-neutral-100 text-neutral-700" : p.tier === "ADVANCED_PRACTITIONER" ? "bg-accent-2-100 text-accent-2-800" : "bg-accent-100 text-accent-700")}>
                  {p.tierLabel}
                </span>
                <span className="text-neutral-400 text-[17px] font-semibold transition group-hover:translate-x-1 group-hover:text-accent">&rarr;</span>
              </div>
              <h3 className="font-heading font-semibold text-[19px] leading-[1.28] mt-5">{p.title}</h3>
              <p className="text-[13px] leading-[1.62] text-neutral-600 mt-[9px] min-h-[63px]">{p.blurb}</p>
              <div className="flex gap-5 mt-5 pt-4 border-t border-dashed border-neutral-300 text-[11.5px] text-neutral-600">
                <span>{p.weeks}</span>
                <span>{p.credits}</span>
                <span className="ml-auto font-semibold text-accent">View programme</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
