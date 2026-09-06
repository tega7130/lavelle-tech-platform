import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * Add if absent, remove if present — the one call a heart-icon button
 * ever needs. The unique (candidateId, documentTemplateId) pair is what
 * makes this safe to call repeatedly/rapidly: a create() that loses a
 * race to a concurrent duplicate hits P2002, which is treated as "already
 * favorited" rather than an error, so double-clicking never produces two
 * rows or a thrown exception.
 */
export async function toggleFavorite(candidateId: string, documentTemplateId: string): Promise<{ favorited: boolean }> {
  const existing = await prisma.documentFavorite.findUnique({
    where: { candidateId_documentTemplateId: { candidateId, documentTemplateId } },
  });

  if (existing) {
    await prisma.documentFavorite.delete({ where: { id: existing.id } }).catch((e) => {
      // Already gone (a concurrent toggle got there first) — the end
      // state (not favorited) is what both callers wanted anyway.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return;
      throw e;
    });
    return { favorited: false };
  }

  try {
    await prisma.documentFavorite.create({ data: { candidateId, documentTemplateId } });
    return { favorited: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { favorited: true }; // a concurrent toggle already created it
    }
    throw e;
  }
}

export async function isDocumentFavorited(candidateId: string, documentTemplateId: string): Promise<boolean> {
  const existing = await prisma.documentFavorite.findUnique({
    where: { candidateId_documentTemplateId: { candidateId, documentTemplateId } },
  });
  return !!existing;
}
