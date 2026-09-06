import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { listCandidateDocuments, type DocumentSort } from "@/lib/candidate-document-reads";
import { DocumentFiltersBar } from "@/components/portal/document-filters-bar";
import { DocumentTemplateCard } from "@/components/portal/document-template-card";

export default async function BrowseTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const documents = await listCandidateDocuments({ q: sp.q, category: sp.category, sort: sp.sort as DocumentSort | undefined });
  const hasFilters = !!(sp.q || sp.category);

  return (
    <div className="max-w-[1180px]">
      <DocumentFiltersBar q={sp.q ?? ""} category={sp.category ?? ""} sort={sp.sort ?? "newest"} />

      {documents.length === 0 ? (
        <Card elev="sm" className="items-center px-6 py-12 text-center">
          <div className="font-heading font-semibold text-[15px]">{hasFilters ? "No templates match your search" : "No documents yet"}</div>
          <p className="mx-auto mt-2 max-w-[44ch] text-[12.5px] text-neutral-600">
            {hasFilters
              ? "Try clearing filters or searching a different term."
              : "New document templates will appear here as soon as they're published."}
          </p>
          {hasFilters && (
            <Link href="/portal/library/templates" className={buttonClassName("secondary", "mt-4")}>
              Clear filters
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((d) => (
            <DocumentTemplateCard key={d.id} document={d} />
          ))}
        </div>
      )}
    </div>
  );
}
