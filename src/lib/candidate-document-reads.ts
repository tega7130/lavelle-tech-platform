import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentCandidate } from "@/lib/candidate-session";
import type { Prisma } from "@/generated/prisma/client";

// Candidate-facing server functions — called directly from Server
// Components, no client fetch. Every select below is deliberately
// public-safe (rule mirrored from getProgrammeDetail's own comment): a
// candidate is never shown purchaseCount, revenueMinor, uploadedByStaffId
// or storageKey — the select list IS the enforcement, not just a
// rendering choice. Downloads/viewing always resolve storageKey
// server-side from the id, after an ownership check (document-purchase.ts).

const CANDIDATE_DOCUMENT_SELECT = {
  id: true,
  title: true,
  category: { select: { id: true, name: true } },
  description: true,
  priceMinor: true,
  compareAtPriceMinor: true,
  currency: true,
  fileType: true,
  fileName: true,
  fileBytes: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.DocumentTemplateSelect;

export type CandidateDocumentSummary = Prisma.DocumentTemplateGetPayload<{ select: typeof CANDIDATE_DOCUMENT_SELECT }>;

export type DocumentSort = "newest" | "price_asc" | "price_desc" | "popular";

function resolveOrderBy(sort?: DocumentSort): Prisma.DocumentTemplateOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { priceMinor: "asc" };
    case "price_desc":
      return { priceMinor: "desc" };
    // Sorts by purchaseCount without ever selecting or returning it —
    // candidates never see the number itself (rule 5/27 of the Phase 2 spec).
    case "popular":
      return { purchaseCount: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

async function annotateViewerState<T extends { id: string }>(candidateId: string | null, documents: T[]) {
  if (!candidateId || documents.length === 0) {
    return documents.map((d) => ({ ...d, viewerFavorited: false, viewerOwns: false }));
  }
  const ids = documents.map((d) => d.id);
  const [favorites, purchases] = await Promise.all([
    prisma.documentFavorite.findMany({ where: { candidateId, documentTemplateId: { in: ids } }, select: { documentTemplateId: true } }),
    prisma.documentPurchase.findMany({
      where: { candidateId, documentTemplateId: { in: ids }, purchasedAt: { not: null } },
      select: { documentTemplateId: true },
    }),
  ]);
  const favSet = new Set(favorites.map((f) => f.documentTemplateId));
  const ownSet = new Set(purchases.map((p) => p.documentTemplateId));
  return documents.map((d) => ({ ...d, viewerFavorited: favSet.has(d.id), viewerOwns: ownSet.has(d.id) }));
}

export interface ListCandidateDocumentsParams {
  q?: string;
  categoryId?: string;
  sort?: DocumentSort;
}

/** Every category — used for the browse page's filter pills, since admins can add new ones (no fixed/hardcoded list). */
export async function listDocumentCategoriesForCandidates() {
  return prisma.documentCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Browse/search/filter/sort — only ever ACTIVE templates (an inactive one is invisible here, same as an unpublished BlogPost). */
export async function listCandidateDocuments(params: ListCandidateDocumentsParams = {}) {
  const candidate = await getCurrentCandidate();

  const documents = await prisma.documentTemplate.findMany({
    where: {
      isActive: true,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.q
        ? { OR: [{ title: { contains: params.q, mode: "insensitive" } }, { description: { contains: params.q, mode: "insensitive" } }] }
        : {}),
    },
    select: CANDIDATE_DOCUMENT_SELECT,
    orderBy: resolveOrderBy(params.sort),
  });

  return annotateViewerState(candidate?.id ?? null, documents);
}

/**
 * Unlike listCandidateDocuments, this does NOT filter out an inactive
 * template — a candidate who already favorited or purchased one must
 * still be able to open it and see "no longer available" (spec's
 * Template Unavailable error state), rather than a bare 404. null means
 * genuinely doesn't exist.
 */
export async function getCandidateDocumentDetail(id: string) {
  const candidate = await getCurrentCandidate();
  const doc = await prisma.documentTemplate.findUnique({ where: { id }, select: CANDIDATE_DOCUMENT_SELECT });
  if (!doc) return null;

  const [{ viewerFavorited, viewerOwns }] = await annotateViewerState(candidate?.id ?? null, [doc]);
  return { ...doc, viewerFavorited, viewerOwns };
}

/** My Favorites — includes an inactive template (marked unavailable) rather than silently dropping it. */
export async function listCandidateFavorites() {
  const candidate = await getCurrentCandidate();
  if (!candidate) return [];

  const favorites = await prisma.documentFavorite.findMany({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: "desc" },
    select: { documentTemplate: { select: CANDIDATE_DOCUMENT_SELECT } },
  });
  const documents = favorites.map((f) => f.documentTemplate);
  const ids = documents.map((d) => d.id);
  const purchases = ids.length
    ? await prisma.documentPurchase.findMany({
        where: { candidateId: candidate.id, documentTemplateId: { in: ids }, purchasedAt: { not: null } },
        select: { documentTemplateId: true },
      })
    : [];
  const ownSet = new Set(purchases.map((p) => p.documentTemplateId));
  return documents.map((d) => ({ ...d, viewerFavorited: true, viewerOwns: ownSet.has(d.id) }));
}

export interface ListCandidatePurchasesParams {
  q?: string;
  sort?: "date" | "title";
}

/** My Purchases — confirmed purchases only (purchasedAt not null); a failed/pending attempt never appears here. */
export async function listCandidatePurchases(params: ListCandidatePurchasesParams = {}) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return [];

  const purchases = await prisma.documentPurchase.findMany({
    where: {
      candidateId: candidate.id,
      purchasedAt: { not: null },
      ...(params.q ? { documentTemplate: { title: { contains: params.q, mode: "insensitive" } } } : {}),
    },
    select: {
      id: true,
      purchasedAt: true,
      amountMinor: true,
      currency: true,
      documentTemplate: {
        select: { id: true, title: true, category: { select: { id: true, name: true } }, fileType: true, fileName: true, fileBytes: true, isActive: true },
      },
    },
    orderBy: params.sort === "title" ? { documentTemplate: { title: "asc" } } : { purchasedAt: "desc" },
  });

  const ids = purchases.map((p) => p.documentTemplate.id);
  const favorites = ids.length
    ? await prisma.documentFavorite.findMany({ where: { candidateId: candidate.id, documentTemplateId: { in: ids } }, select: { documentTemplateId: true } })
    : [];
  const favSet = new Set(favorites.map((f) => f.documentTemplateId));
  return purchases.map((p) => ({ ...p, viewerFavorited: favSet.has(p.documentTemplate.id) }));
}
