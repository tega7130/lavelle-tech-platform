import { z } from "zod";

// Base object kept separate from the create schema's file fields so
// updateDocumentMetadataSchema can reuse it without pulling in
// upload-only fields — metadata edits never re-upload the file (spec).
// categoryId is validated for shape only here — existence is enforced by
// the DocumentCategory foreign key at the DB layer (same discipline as
// Programme.categoryId in validation/programme.ts).
const documentMetadataSchema = z.object({
  title: z.string().trim().min(1, "Required").max(200),
  categoryId: z.string().min(1, "Choose a category"),
  description: z.string().trim().max(2000).optional(),
  // The admin types naira (a human amount, e.g. "15000"); the server
  // converts to kobo — priceMinor itself is never entered directly, same
  // discipline as Programme.feeNaira/feeMinor (src/lib/validation/programme.ts).
  priceNaira: z.coerce.number().nonnegative("Price cannot be negative").finite(),
  // Optional "was" price for a sale display (compareAtPriceMinor) — a plain
  // naira amount, same conversion discipline as priceNaira. Checked against
  // priceNaira below since a "sale" that isn't actually cheaper is a
  // mistake, not a valid state.
  compareAtPriceNaira: z.coerce.number().positive("Must be greater than 0").finite().optional(),
});

function checkCompareAtPrice(data: { priceNaira: number; compareAtPriceNaira?: number }, ctx: z.RefinementCtx) {
  if (data.compareAtPriceNaira !== undefined && data.compareAtPriceNaira <= data.priceNaira) {
    ctx.addIssue({ code: "custom", path: ["compareAtPriceNaira"], message: "Must be higher than the price for a sale to show." });
  }
}

export const createDocumentTemplateSchema = documentMetadataSchema
  .extend({
    storageKey: z.string().min(1),
    fileType: z.string().min(1),
    fileName: z.string().min(1),
    fileBytes: z.number().int().positive(),
  })
  .superRefine(checkCompareAtPrice);
export type CreateDocumentTemplateInput = z.infer<typeof createDocumentTemplateSchema>;

export const updateDocumentTemplateSchema = documentMetadataSchema.superRefine(checkCompareAtPrice);
export type UpdateDocumentTemplateInput = z.infer<typeof updateDocumentTemplateSchema>;

// value is a raw human number, interpreted per type: a percent (1-100) for
// PERCENT, or naira (converted to kobo server-side, same as priceNaira) for
// FIXED — never the stored minor-unit integer directly, same discipline as
// priceNaira above.
export const createDiscountCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "At least 3 characters")
      .max(40, "Too long")
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, hyphens and underscores only"),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().positive("Must be greater than 0"),
    expiresAt: z.string().trim().optional(),
    maxRedemptions: z.coerce.number().int().positive("Must be a whole number greater than 0").optional(),
    // Omitted or empty = applies to every document.
    documentTemplateIds: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENT" && data.value > 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "A percent discount cannot exceed 100." });
    }
  });
export type CreateDiscountCodeInput = z.infer<typeof createDiscountCodeSchema>;

/** Flattens a Zod error into the { fieldName: message } shape the UI renders inline, per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
