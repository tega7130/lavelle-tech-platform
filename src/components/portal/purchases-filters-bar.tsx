"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { Input } from "@/components/ui/field";

const SORT_OPTIONS = [
  { value: "date", label: "Newest" },
  { value: "title", label: "Title" },
];

export function PurchasesFiltersBar({ q, sort }: { q: string; sort: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(q);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mb-[var(--space-5)] flex flex-wrap items-center gap-3">
      <Input
        dense
        placeholder="Search your purchases…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", query);
        }}
        onBlur={() => setParam("q", query)}
        className="h-11 w-full sm:max-w-[280px]"
      />
      <Segmented name="purchaseSort" value={sort} onChange={(v) => setParam("sort", v)} options={SORT_OPTIONS} />
    </div>
  );
}
