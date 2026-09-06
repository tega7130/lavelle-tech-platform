import Link from "next/link";
import { Card, CardTitle, CardBody } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { FavoriteButton } from "@/components/portal/favorite-button";
import { DownloadButton } from "@/components/portal/document-file-buttons";
import type { CandidateDocumentSummary } from "@/lib/candidate-document-reads";

export type TemplateCardDocument = CandidateDocumentSummary & { viewerFavorited: boolean; viewerOwns: boolean };

/**
 * The one card used by Browse, My Favorites and (in a denser row) My
 * Purchases — never displays purchaseCount, ratings or any other
 * admin-only/social-proof figure (spec rule 5).
 */
export function DocumentTemplateCard({ document }: { document: TemplateCardDocument }) {
  const detailHref = `/portal/library/templates/${document.id}`;

  return (
    <Card elev="sm" className="overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <Tag variant="accent">{document.category.name}</Tag>
          {!document.isActive && <Tag variant="danger">Unavailable</Tag>}
        </div>
        <FavoriteButton documentTemplateId={document.id} initialFavorited={document.viewerFavorited} className="h-8 w-8" />
      </div>

      <CardTitle className="mt-1.5">
        <Link href={detailHref} className="text-text no-underline hover:underline">
          {document.title}
        </Link>
      </CardTitle>
      <CardBody className="line-clamp-2">{document.description || "No description provided."}</CardBody>

      <div className="my-1 border-t border-dashed border-neutral-300" />

      <div className="flex items-center justify-between gap-2">
        <span className="font-heading text-[15px]">{formatNaira(document.priceMinor)}</span>

        {document.viewerOwns ? (
          <div className="flex items-center gap-2">
            <Tag variant="success">Purchased</Tag>
            <DownloadButton documentTemplateId={document.id} variant="secondary" className="h-8 px-3 text-xs" />
          </div>
        ) : (
          <Link
            href={detailHref}
            className={buttonClassName(document.isActive ? "primary" : "secondary", "h-8 px-3 text-xs")}
            aria-disabled={!document.isActive}
          >
            {document.isActive ? "View details" : "Unavailable"}
          </Link>
        )}
      </div>
    </Card>
  );
}
