"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getSignedAssetUrl } from "@/lib/storage";
import {
  createDocumentTemplate,
  updateDocumentTemplateMetadata,
  setDocumentTemplateActive,
  deleteDocumentTemplate,
  createDocumentCategory,
  createDiscountCode,
  setDiscountCodeActive,
} from "@/lib/document-library-actions";
import {
  createDocumentTemplateSchema,
  updateDocumentTemplateSchema,
  createDiscountCodeSchema,
  fieldErrors,
} from "@/lib/validation/document-library";

function revalidateAll() {
  revalidatePath("/admin/document-library");
}

export async function createDocumentTemplateAction(input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  const parsed = createDocumentTemplateSchema.safeParse(input);
  if (!parsed.success) throw new Error(Object.values(fieldErrors(parsed.error))[0] ?? "Invalid input.");

  const document = await createDocumentTemplate(
    {
      title: parsed.data.title,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      priceMinor: Math.round(parsed.data.priceNaira * 100),
      storageKey: parsed.data.storageKey,
      fileType: parsed.data.fileType,
      fileName: parsed.data.fileName,
      fileBytes: parsed.data.fileBytes,
    },
    staff.id
  );
  revalidateAll();
  return document;
}

export async function updateDocumentTemplateAction(id: string, input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  const parsed = updateDocumentTemplateSchema.safeParse(input);
  if (!parsed.success) throw new Error(Object.values(fieldErrors(parsed.error))[0] ?? "Invalid input.");

  const document = await updateDocumentTemplateMetadata(
    id,
    {
      title: parsed.data.title,
      categoryId: parsed.data.categoryId,
      description: parsed.data.description,
      priceMinor: Math.round(parsed.data.priceNaira * 100),
    },
    staff.id
  );
  revalidateAll();
  return document;
}

/** Inline "+ New category" creation from the Upload/Edit dialogs — mirrors createCategory (programmes) exactly. */
export async function createDocumentCategoryAction(name: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  const category = await createDocumentCategory(name, staff.id);
  revalidateAll();
  return category;
}

export async function setDocumentTemplateActiveAction(id: string, isActive: boolean) {
  const staff = await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  const document = await setDocumentTemplateActive(id, isActive, staff.id);
  revalidateAll();
  return document;
}

export async function deleteDocumentTemplateAction(id: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  await deleteDocumentTemplate(id, staff.id);
  revalidateAll();
}

export async function createDiscountCodeAction(input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  const parsed = createDiscountCodeSchema.safeParse(input);
  if (!parsed.success) throw new Error(Object.values(fieldErrors(parsed.error))[0] ?? "Invalid input.");

  // Percent is stored as-is (1-100); fixed is naira from the form, converted
  // to kobo — same priceNaira -> priceMinor discipline as document pricing.
  const value = parsed.data.type === "PERCENT" ? Math.round(parsed.data.value) : Math.round(parsed.data.value * 100);
  const code = await createDiscountCode(
    {
      code: parsed.data.code.toUpperCase(),
      type: parsed.data.type,
      value,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      maxRedemptions: parsed.data.maxRedemptions,
      documentTemplateIds: parsed.data.documentTemplateIds,
    },
    staff.id
  );
  revalidateAll();
  return code;
}

export async function setDiscountCodeActiveAction(id: string, isActive: boolean) {
  const staff = await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  const code = await setDiscountCodeActive(id, isActive, staff.id);
  revalidateAll();
  return code;
}

/** A fresh signed download URL for the underlying file — Cloudinary raw assets, same signed/expiring discipline as every other MediaAsset (storage.ts rule 10). */
export async function getDocumentFileUrlAction(storageKey: string) {
  await requireStaffPermission(Permission.MANAGE_DOCUMENT_LIBRARY);
  return getSignedAssetUrl(storageKey, "raw");
}
