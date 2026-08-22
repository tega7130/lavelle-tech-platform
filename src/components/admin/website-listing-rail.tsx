"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { reorderListingsAction } from "@/app/actions/website-admin";
import type { listListings } from "@/lib/website-admin";

type Listing = Awaited<ReturnType<typeof listListings>>[number];

/** Up/down controls only reorder published listings (README: orderIndex governs the public grid) — draft rows have nothing to reorder against. */
export function WebsiteListingRail({ listings }: { listings: Listing[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const published = listings.filter((l) => l.isPublished).sort((a, b) => a.orderIndex - b.orderIndex);

  async function move(programmeId: string, direction: -1 | 1) {
    const index = published.findIndex((l) => l.programmeId === programmeId);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= published.length) return;
    const order = published.map((l) => l.programmeId);
    [order[index], order[swapWith]] = [order[swapWith]!, order[index]!];
    setPending(true);
    try {
      await reorderListingsAction(order);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col">
      {listings.map((p) => {
        const publishedIndex = p.isPublished ? published.findIndex((l) => l.programmeId === p.programmeId) : -1;
        return (
          <div key={p.programmeId} className="flex items-start gap-[7px] rounded-md hover:bg-neutral-100">
            <Link href={`/admin/website/${p.programmeId}`} className="flex-1 min-w-0 flex items-start gap-[11px] px-3 py-[11px] no-underline text-text">
              <span className={cn("w-2 h-2 flex-none mt-[6px] rounded-full", p.isPublished ? "bg-[#15803d]" : "bg-neutral-400")} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium leading-[1.35]">{p.title}</div>
                <div className="text-neutral-500 text-[11px] mt-[2px]">
                  {p.code} · {p.tierLabel}
                </div>
              </div>
              <span className={cn("tag flex-none text-[9.5px] font-semibold", p.isPublished ? "bg-[#e7f6ed] text-[#15803d]" : "bg-neutral-100 text-neutral-700")}>
                {p.isPublished ? "Live" : "Draft"}
              </span>
            </Link>
            {p.isPublished && (
              <div className="flex flex-col pt-[9px] pr-1">
                <button
                  type="button"
                  aria-label={`Move ${p.title} earlier on the public grid`}
                  disabled={pending || publishedIndex <= 0}
                  onClick={() => move(p.programmeId, -1)}
                  className="w-5 h-4 flex items-center justify-center text-neutral-500 hover:text-accent disabled:opacity-30 disabled:hover:text-neutral-500"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`Move ${p.title} later on the public grid`}
                  disabled={pending || publishedIndex >= published.length - 1}
                  onClick={() => move(p.programmeId, 1)}
                  className="w-5 h-4 flex items-center justify-center text-neutral-500 hover:text-accent disabled:opacity-30 disabled:hover:text-neutral-500"
                >
                  ▼
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
