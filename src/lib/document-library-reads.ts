import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";

/** Admin: every non-deleted document template, newest first — the source for the Document Library screen. A soft-deleted row (deleteDocumentTemplate) never appears here, same as a real delete would, even though it still exists for its purchasers. */
export async function listDocumentTemplates() {
  await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  return prisma.documentTemplate.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { category: true } });
}

export async function getDocumentTemplateById(id: string) {
  await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  return prisma.documentTemplate.findUniqueOrThrow({ where: { id, deletedAt: null }, include: { category: true } });
}

/** Every category, for the Upload/Edit dialogs' picker — alphabetical, same as ProgrammeCategory has no fixed order either. */
export async function listDocumentCategories() {
  await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  return prisma.documentCategory.findMany({ orderBy: { name: "asc" } });
}
