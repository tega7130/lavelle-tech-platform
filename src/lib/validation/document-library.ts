import { z } from "zod";
import { DOCUMENT_CATEGORY_VALUES } from "@/lib/document-library";

// Base object kept separate from the create schema's file fields so
// updateDocumentMetadataSchema can reuse it without pulling in
// upload-only fields — metadata edits never re-upload the file (spec).
const documentMetadataSchema = z.object({
  title: z.string().trim().min(1, "Required").max(200),
  category: z.enum(DOCUMENT_CATEGORY_VALUES),
  description: z.string().trim().max(2000).optional(),
  // The admin types naira (a human amount, e.g. "15000"); the server
  // converts to kobo — priceMinor itself is never entered directly, same
  // discipline as Programme.feeNaira/feeMinor (src/lib/validation/programme.ts).
  priceNaira: z.coerce.number().nonnegative("Price cannot be negative").finite(),
});

export const createDocumentTemplateSchema = documentMetadataSchema.extend({
  storageKey: z.string().min(1),
  fileType: z.string().min(1),
  fileName: z.string().min(1),
  fileBytes: z.number().int().positive(),
});
export type CreateDocumentTemplateInput = z.infer<typeof createDocumentTemplateSchema>;

export const updateDocumentTemplateSchema = documentMetadataSchema;
export type UpdateDocumentTemplateInput = z.infer<typeof updateDocumentTemplateSchema>;

/** Flattens a Zod error into the { fieldName: message } shape the UI renders inline, per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
