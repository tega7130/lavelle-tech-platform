import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ACCEPTED_DOCUMENT_MIME_TYPES } from "@/lib/document-library";
import { formatNaira } from "@/lib/format";

// Public website (Phase 3) — unauthenticated visitors, no session at all.
// The select list below IS the enforcement (same discipline as
// candidate-document-reads.ts's own comment): a visitor is never shown
// storageKey, fileName, fileBytes, purchaseCount, revenueMinor or
// uploadedByStaffId, no matter what this model later grows for admin or
// candidate purposes — those fields simply never enter this file.
const PUBLIC_DOCUMENT_SELECT = {
  id: true,
  title: true,
  category: { select: { id: true, name: true } },
  description: true,
  priceMinor: true,
  compareAtPriceMinor: true,
  fileType: true,
  createdAt: true,
} satisfies Prisma.DocumentTemplateSelect;

type PublicDocumentRow = Prisma.DocumentTemplateGetPayload<{ select: typeof PUBLIC_DOCUMENT_SELECT }>;

function toPublicSummary(doc: PublicDocumentRow) {
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category,
    description: doc.description,
    priceMinor: doc.priceMinor,
    compareAtPriceMinor: doc.compareAtPriceMinor,
    fileFormat: ACCEPTED_DOCUMENT_MIME_TYPES[doc.fileType] ?? "Document",
    createdAt: doc.createdAt.toISOString(),
  };
}

export type PublicDocumentSummary = ReturnType<typeof toPublicSummary> & { complementaryIds: string[] };

/**
 * Every listed (active, non-deleted) template, each annotated with the
 * ids of its currently-listed complementary templates. This is the
 * Library's entire public data source in one shot: the client component
 * searches/filters/sorts it in memory (same shape as ProgrammeCatalogue,
 * the site's only other public catalogue — no URL-driven filtering, no
 * debounce), and the preview modal resolves a complementary template by
 * looking up its id in this same array — no separate per-template fetch,
 * no public API route, so a visitor can move between related templates
 * without ever leaving the page.
 */
export async function getPublicDocumentTemplates(): Promise<PublicDocumentSummary[]> {
  const documents = await prisma.documentTemplate.findMany({
    where: { isActive: true, deletedAt: null },
    select: PUBLIC_DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
  });

  const ids = documents.map((d) => d.id);
  const relations = ids.length
    ? await prisma.documentTemplateRelation.findMany({
        where: { documentTemplateId: { in: ids }, relatedDocumentTemplate: { isActive: true, deletedAt: null } },
        select: { documentTemplateId: true, relatedDocumentTemplateId: true },
      })
    : [];
  const complementaryByDoc = new Map<string, string[]>();
  for (const r of relations) {
    const list = complementaryByDoc.get(r.documentTemplateId) ?? [];
    list.push(r.relatedDocumentTemplateId);
    complementaryByDoc.set(r.documentTemplateId, list);
  }

  return documents.map((d) => ({ ...toPublicSummary(d), complementaryIds: complementaryByDoc.get(d.id) ?? [] }));
}

/** Category pills with a dynamic, live count of currently-listed templates — never hardcoded. A category with nothing currently listed is omitted rather than shown as a dead filter. */
export async function getPublicDocumentCategories() {
  const categories = await prisma.documentCategory.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { documents: { where: { isActive: true, deletedAt: null } } } },
    },
  });
  return categories.map((c) => ({ id: c.id, name: c.name, count: c._count.documents })).filter((c) => c.count > 0);
}

export interface LibraryPromotion {
  headline: string;
}

/**
 * Derived live from DiscountCode — never hardcoded, never rendered when
 * nothing is actually active. Reveals only a magnitude ("save up to
 * ₦X"/"up to X%"), never the code string itself or which documents it's
 * scoped to (DiscountCodeDocument) — those stay behind sign-up, same as
 * every other restricted purchase detail.
 */
export async function getActiveLibraryPromotion(): Promise<LibraryPromotion | null> {
  const now = new Date();
  const codes = await prisma.discountCode.findMany({
    where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { type: true, value: true, maxRedemptions: true, redemptionCount: true },
  });
  const eligible = codes.filter((c) => c.maxRedemptions == null || c.redemptionCount < c.maxRedemptions);
  if (eligible.length === 0) return null;

  const bestFixed = Math.max(0, ...eligible.filter((c) => c.type === "FIXED").map((c) => c.value));
  if (bestFixed > 0) return { headline: `Limited-time offer: Save up to ${formatNaira(bestFixed)} on selected templates. Sign up to view.` };

  const bestPercent = Math.max(0, ...eligible.filter((c) => c.type === "PERCENT").map((c) => c.value));
  if (bestPercent > 0) return { headline: `Limited-time offer: Save up to ${bestPercent}% on selected templates. Sign up to view.` };

  return null;
}
