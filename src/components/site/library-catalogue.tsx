"use client";

import * as React from "react";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LibraryTemplateModal } from "@/components/site/library-template-modal";
import type { PublicDocumentSummary } from "@/lib/public-document-library-reads";

type SortValue = "newest" | "alphabetical" | "price_asc" | "price_desc";

// Never "Most Popular"/"Trending"/"Best Selling" — purchase popularity has
// no place in the public browsing experience (spec rule 13).
const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export interface LibraryCategory {
  id: string;
  name: string;
  count: number;
}

/**
 * Deliberately never shows purchase count, ratings, "Most Popular", a
 * download/view-online button, or a document thumbnail (spec rule 9) —
 * price is present but visually secondary to the "View Details" CTA.
 */
function PublicTemplateCard({ document, onView }: { document: PublicDocumentSummary; onView: () => void }) {
  return (
    <div className="group flex flex-col bg-bg border border-divider rounded-[14px] p-[22px] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(19,26,46,0.1)] hover:border-accent-200">
      <div className="flex items-center justify-between gap-2">
        <Tag variant="accent">{document.category.name}</Tag>
        <span className="text-[10.5px] text-neutral-500 font-medium">{document.fileFormat}</span>
      </div>
      <h3 className="font-heading font-semibold text-[17px] leading-[1.3] mt-3">{document.title}</h3>
      <p className="text-[13px] leading-[1.6] text-neutral-600 mt-2 line-clamp-2 flex-1">
        {document.description || "A professionally drafted template, ready to customise for your matter."}
      </p>
      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-dashed border-neutral-300">
        <span className="text-[13px] text-neutral-600">{formatNaira(document.priceMinor)}</span>
        <button type="button" onClick={onView} className={cn(buttonClassName("secondary"), "h-9 px-4 text-[12.5px]")}>
          View Details
        </button>
      </div>
    </div>
  );
}

/**
 * The whole public Library grid: search + category pills + sort + cards +
 * preview modal, all client-side over data fetched once server-side —
 * same shape as ProgrammeCatalogue (the site's only other public
 * catalogue). Category filtering is a filtered view of this one
 * component, never a route (spec rule 11).
 */
export function LibraryCatalogue({ documents, categories }: { documents: PublicDocumentSummary[]; categories: LibraryCategory[] }) {
  const [query, setQuery] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [sort, setSort] = React.useState<SortValue>("newest");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const byId = React.useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = documents.filter((d) => {
      const matchesCategory = !categoryId || d.category.id === categoryId;
      const matchesQuery =
        q.length === 0 || d.title.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q) || d.category.name.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "alphabetical":
          return a.title.localeCompare(b.title);
        case "price_asc":
          return a.priceMinor - b.priceMinor;
        case "price_desc":
          return b.priceMinor - a.priceMinor;
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [documents, query, categoryId, sort]);

  return (
    <div>
      <div className="flex flex-col gap-3">
        <div className="relative sm:w-[320px]">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
            <circle cx="7" cy="7" r="5.2" />
            <path d="M11 11 14.5 14.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates by title, description or category"
            aria-label="Search templates"
            className="w-full h-11 pl-9 pr-3 rounded-[9px] border border-divider bg-bg text-[13px] outline-none focus:border-accent-200"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 overflow-x-auto">
            <button
              onClick={() => setCategoryId("")}
              className={cn(
                "px-[14px] py-2 rounded-full text-[12.5px] font-semibold border transition cursor-pointer whitespace-nowrap",
                categoryId === "" ? "bg-accent border-accent text-white" : "bg-bg border-divider text-neutral-700 hover:border-accent-200"
              )}
            >
              All templates ({documents.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "px-[14px] py-2 rounded-full text-[12.5px] font-semibold border transition cursor-pointer whitespace-nowrap",
                  categoryId === c.id ? "bg-accent border-accent text-white" : "bg-bg border-divider text-neutral-700 hover:border-accent-200"
                )}
              >
                {c.name} ({c.count})
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
            aria-label="Sort templates"
            className="h-10 rounded-md border border-neutral-300 bg-bg px-3 text-[13px] text-text flex-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 mt-10 border border-divider rounded-[14px] bg-neutral-100">
          {query.trim() ? (
            <>
              <div className="font-heading font-semibold text-[16px]">No templates found</div>
              <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">Try a different search term or browse all categories.</p>
            </>
          ) : (
            <>
              <div className="font-heading font-semibold text-[16px]">No templates in this category yet</div>
              <p className="text-neutral-600 text-[13px] mt-2 max-w-[44ch] mx-auto">Check back soon or explore another category.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[18px] mt-10">
          {filtered.map((d) => (
            <PublicTemplateCard key={d.id} document={d} onView={() => setSelectedId(d.id)} />
          ))}
        </div>
      )}

      {selected && (
        <LibraryTemplateModal
          document={selected}
          complementary={selected.complementaryIds.map((id) => byId.get(id)).filter((d): d is PublicDocumentSummary => !!d)}
          onClose={() => setSelectedId(null)}
          onSelectComplementary={(id) => setSelectedId(id)}
        />
      )}
    </div>
  );
}
