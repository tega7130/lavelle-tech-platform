import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as blog-admin-actions.ts. staffId is always passed in by the
// caller (a "use server" Action that already checked the permission),
// which keeps this file importable from plain Vitest tests.

export interface DocumentTemplateFileInput {
  storageKey: string;
  fileType: string;
  fileName: string;
  fileBytes: number;
}

export interface DocumentTemplateMetadataInput {
  title: string;
  category: string;
  description?: string;
  priceMinor: number;
}

export async function createDocumentTemplate(
  input: DocumentTemplateMetadataInput & DocumentTemplateFileInput,
  staffId: string
) {
  const document = await prisma.documentTemplate.create({
    data: {
      title: input.title,
      category: input.category,
      description: input.description || null,
      priceMinor: input.priceMinor,
      storageKey: input.storageKey,
      fileType: input.fileType,
      fileName: input.fileName,
      fileBytes: input.fileBytes,
      uploadedByStaffId: staffId,
    },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "document_template",
    subjectId: document.id,
    action: "document_template.created",
    description: `Uploaded the document template "${document.title}"`,
  });
  return document;
}

/** Metadata only — the administrator is never required to re-upload the file to change title/category/description/price. */
export async function updateDocumentTemplateMetadata(
  id: string,
  input: DocumentTemplateMetadataInput,
  staffId: string
) {
  const document = await prisma.documentTemplate.update({
    where: { id },
    data: {
      title: input.title,
      category: input.category,
      description: input.description || null,
      priceMinor: input.priceMinor,
    },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "document_template",
    subjectId: document.id,
    action: "document_template.updated",
    description: `Updated the document template "${document.title}"`,
  });
  return document;
}

export async function setDocumentTemplateActive(id: string, isActive: boolean, staffId: string) {
  const document = await prisma.documentTemplate.update({ where: { id }, data: { isActive } });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "document_template",
    subjectId: document.id,
    action: isActive ? "document_template.activated" : "document_template.deactivated",
    description: `${isActive ? "Activated" : "Deactivated"} the document template "${document.title}"`,
  });
  return document;
}

/** Hard delete — same discipline as deleteBlogPost: nothing references a DocumentTemplate yet (Phase 2's candidate purchase flow isn't built), so there is nothing left orphaned. */
export async function deleteDocumentTemplate(id: string, staffId: string) {
  const document = await prisma.documentTemplate.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "document_template",
      subjectId: document.id,
      action: "document_template.deleted",
      description: `Deleted the document template "${document.title}"`,
    });
    await tx.documentTemplate.delete({ where: { id } });
  });
  return document;
}
