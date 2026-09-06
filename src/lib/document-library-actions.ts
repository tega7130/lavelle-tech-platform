import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { DiscountType } from "@/generated/prisma/client";

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
  categoryId: string;
  description?: string;
  priceMinor: number;
}

/** Case-insensitive dedupe on name — returns the existing row on match rather than creating a near-duplicate. Mirrors app/actions/programme.ts's createCategory exactly. */
export async function createDocumentCategory(name: string, staffId: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");

  const existing = await prisma.documentCategory.findFirst({ where: { name: { equals: trimmed, mode: "insensitive" } } });
  if (existing) return existing;

  const created = await prisma.documentCategory.create({ data: { name: trimmed, slug: slugify(trimmed) } });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "document_category",
    subjectId: created.id,
    action: "document_category.created",
    description: `Created document category "${trimmed}"`,
  });
  return created;
}

export async function createDocumentTemplate(
  input: DocumentTemplateMetadataInput & DocumentTemplateFileInput,
  staffId: string
) {
  const document = await prisma.documentTemplate.create({
    data: {
      title: input.title,
      categoryId: input.categoryId,
      description: input.description || null,
      priceMinor: input.priceMinor,
      storageKey: input.storageKey,
      fileType: input.fileType,
      fileName: input.fileName,
      fileBytes: input.fileBytes,
      uploadedByStaffId: staffId,
    },
    include: { category: true },
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
      categoryId: input.categoryId,
      description: input.description || null,
      priceMinor: input.priceMinor,
    },
    include: { category: true },
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

/**
 * Soft delete — NOT a real row removal. A candidate who already
 * purchased this template must keep permanent access to it (downloading
 * and viewing it, indefinitely — same as any other confirmed purchase),
 * so the row, its file reference and its DocumentPurchase rows all stay
 * intact; only deletedAt/isActive change. listDocumentTemplates (the
 * admin list) filters deletedAt out, so it disappears from the admin's
 * working set exactly like a real delete would, while
 * getDocumentFileAccessAction and My Purchases keep resolving it by id
 * regardless of this column.
 */
export interface CreateDiscountCodeInput {
  code: string;
  type: DiscountType;
  // Already converted to the stored unit by the caller: a percent (1-100)
  // for PERCENT, kobo for FIXED — see validateAndComputeDiscount, the only
  // place this value is ever spent.
  value: number;
  expiresAt?: Date;
  maxRedemptions?: number;
}

/**
 * Unlike createDocumentCategory, a matching code is never silently reused —
 * two codes can carry different value/expiry/limits, so a name collision is
 * a real error rather than something to dedupe away. DiscountCode.code is
 * citext, so the DB's own unique constraint is already case-insensitive;
 * this check just turns that into a friendly message instead of a raw P2002.
 */
export async function createDiscountCode(input: CreateDiscountCodeInput, staffId: string) {
  const existing = await prisma.discountCode.findUnique({ where: { code: input.code } });
  if (existing) throw new Error("A discount code with this name already exists.");

  const created = await prisma.discountCode.create({
    data: {
      code: input.code,
      type: input.type,
      value: input.value,
      expiresAt: input.expiresAt ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
    },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "discount_code",
    subjectId: created.id,
    action: "discount_code.created",
    description: `Created discount code "${created.code}"`,
  });
  return created;
}

/** Deactivating, not deleting — a code already redeemed on a confirmed DocumentPurchase must stay resolvable (same FK-restrict reasoning as DocumentTemplate), and a discount snapshot is already frozen onto that purchase, so there is nothing a real delete would protect here anyway. */
export async function setDiscountCodeActive(id: string, isActive: boolean, staffId: string) {
  const code = await prisma.discountCode.update({ where: { id }, data: { isActive } });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "discount_code",
    subjectId: code.id,
    action: isActive ? "discount_code.activated" : "discount_code.deactivated",
    description: `${isActive ? "Activated" : "Deactivated"} discount code "${code.code}"`,
  });
  return code;
}

export async function deleteDocumentTemplate(id: string, staffId: string) {
  const document = await prisma.documentTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "document_template",
    subjectId: document.id,
    action: "document_template.deleted",
    description: `Deleted the document template "${document.title}"`,
  });
  return document;
}
