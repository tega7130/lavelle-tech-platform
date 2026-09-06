"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { Input } from "@/components/ui/field";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
];

export interface DocumentCategoryOption {
  id: string;
  name: string;
}

/** Search-on-Enter/blur, filters commit immediately — same discipline as ProgrammesFilterBar (admin). No debounced-as-you-type search exists anywhere else in this app. */
export function DocumentFiltersBar({
  q,
  categoryId,
  sort,
  categories,
}: {
  q: string;
  categoryId: string;
  sort: string;
  categories: DocumentCategoryOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(q);

  const categoryOptions = [{ value: "", label: "All" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mb-[var(--space-5)] flex flex-col gap-3">
      <Input
        dense
        placeholder="Search by title or description…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", query);
        }}
        onBlur={() => setParam("q", query)}
        className="h-11 w-full sm:max-w-[360px]"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented name="category" value={categoryId} onChange={(v) => setParam("category", v)} options={categoryOptions} />
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          aria-label="Sort templates"
          className="h-11 rounded-md border border-neutral-300 bg-bg px-3 text-[13px] text-text"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
