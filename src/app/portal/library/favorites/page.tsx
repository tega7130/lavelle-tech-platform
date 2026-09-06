import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";
import { listCandidateFavorites } from "@/lib/candidate-document-reads";
import { DocumentTemplateCard } from "@/components/portal/document-template-card";

export default async function MyFavoritesPage() {
  const favorites = await listCandidateFavorites();

  if (favorites.length === 0) {
    return (
      <div className="max-w-[820px]">
        <Card elev="sm" className="items-center px-6 py-12 text-center">
          <div className="font-heading font-semibold text-[15px]">No favorites yet</div>
          <p className="mx-auto mt-2 max-w-[46ch] text-[12.5px] text-neutral-600">
            Browse the Document Library to save templates you&apos;re interested in.
          </p>
          <Link href="/portal/library/templates" className={buttonClassName("primary", "mt-4")}>
            Browse Library
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1180px]">
      <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((d) => (
          <DocumentTemplateCard key={d.id} document={d} />
        ))}
      </div>
    </div>
  );
}
