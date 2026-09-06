import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";

/** Admin: every document template, newest first — the source for the Document Library screen. */
export async function listDocumentTemplates() {
  await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  return prisma.documentTemplate.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getDocumentTemplateById(id: string) {
  await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  return prisma.documentTemplate.findUniqueOrThrow({ where: { id } });
}
