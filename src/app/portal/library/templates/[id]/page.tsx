import { notFound } from "next/navigation";
import Link from "next/link";
import { getCandidateDocumentDetail } from "@/lib/candidate-document-reads";
import { formatNaira } from "@/lib/format";
import { ACCEPTED_DOCUMENT_MIME_TYPES } from "@/lib/document-library";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { FavoriteButton } from "@/components/portal/favorite-button";
import { PurchaseButton } from "@/components/portal/purchase-confirmation";
import { DownloadButton, ViewOnlineButton } from "@/components/portal/document-file-buttons";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await getCandidateDocumentDetail(id);
  if (!document) notFound();

  const fileFormatLabel = ACCEPTED_DOCUMENT_MIME_TYPES[document.fileType] ?? document.fileType;

  return (
    <div className="max-w-[820px]">
      <Link href="/portal/library/templates" className="text-[13px] text-accent">
        ← Back to library
      </Link>

      <div className="mt-[var(--space-4)] flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Tag variant="accent">{document.category.name}</Tag>
          {!document.isActive && <Tag variant="danger">Unavailable</Tag>}
        </div>
        <FavoriteButton documentTemplateId={document.id} initialFavorited={document.viewerFavorited} />
      </div>

      <h1 className="m-0 mt-2 font-heading text-[26px]">{document.title}</h1>

      {!document.isActive && (
        <div className="mt-3 rounded-md border border-warning-border bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning-text">
          This document template is no longer available for purchase.
          {document.viewerOwns && " You still have full access to it below."}
        </div>
      )}

      <div className="mt-[var(--space-6)] grid grid-cols-[2fr_1fr] gap-[var(--space-6)] max-[720px]:grid-cols-1">
        <div>
          <h3>About this document</h3>
          <p className="max-w-[640px] whitespace-pre-line text-[14px] text-neutral-700">
            {document.description || "No description has been provided for this template."}
          </p>

          <div className="mt-[var(--space-5)] grid grid-cols-2 gap-3 max-w-[420px] text-[13px]">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">File format</div>
              <div className="mt-0.5">{fileFormatLabel}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">File size</div>
              <div className="mt-0.5">{formatBytes(document.fileBytes)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">Uploaded</div>
              <div className="mt-0.5">{formatDate(document.createdAt)}</div>
            </div>
          </div>
        </div>

        <Card elev="md" className="h-fit">
          <CardKicker>Price</CardKicker>
          {document.compareAtPriceMinor != null && document.compareAtPriceMinor > document.priceMinor && (
            <div className="text-[14px] text-neutral-500 line-through">{formatNaira(document.compareAtPriceMinor)}</div>
          )}
          <div className="font-heading text-[26px]">{formatNaira(document.priceMinor)}</div>
          <div className="mb-3 text-[12px] text-neutral-500">One-time purchase — permanent access</div>

          {document.viewerOwns ? (
            <div className="flex flex-col gap-2">
              <Tag variant="success" className="w-fit">
                Already Purchased
              </Tag>
              <DownloadButton documentTemplateId={document.id} variant="primary" className="w-full justify-center" />
              <ViewOnlineButton documentTemplateId={document.id} variant="secondary" className="w-full justify-center" />
            </div>
          ) : document.isActive ? (
            <PurchaseButton documentTemplateId={document.id} title={document.title} priceMinor={document.priceMinor} fileFormatLabel={fileFormatLabel} />
          ) : (
            <div className="text-[12.5px] text-neutral-500">This template can no longer be purchased.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
