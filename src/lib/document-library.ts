// Document Library — shared vocabulary between the admin form, the table
// and both validation layers, so there is exactly one place an accepted
// file type gets added. Categories are NOT here — they're admin-managed
// rows in the DocumentCategory table (see createDocumentCategory /
// listDocumentCategories), the same pattern as ProgrammeCategory.

// PDF and DOCX only, per spec — keyed by the browser-reported MIME type
// at upload time (never trusted from the client's <input accept> alone;
// see finaliseUpload's purpose === "document_library" branch).
export const ACCEPTED_DOCUMENT_MIME_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

export const ACCEPTED_DOCUMENT_EXTENSIONS = [".pdf", ".docx"];

// A generous ceiling for a legal/professional document template — well
// under the app-wide MAX_UPLOAD_BYTES (2GB, sized for lecture video), but
// no reason to force a real contract or exhibit-heavy MOU below it either.
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB

export function isAcceptedDocumentMimeType(mimeType: string): boolean {
  return mimeType in ACCEPTED_DOCUMENT_MIME_TYPES;
}

/**
 * The one place priceMinor (the admin's "selling price") and
 * discountedPriceMinor (the optional flat sale override) are reconciled
 * into a single number — what's actually charged at checkout, and the
 * prominent price shown everywhere it's listed. priceMinor is struck
 * through beside it whenever discountedPriceMinor is set and lower.
 */
export function effectivePriceMinor(document: { priceMinor: number; discountedPriceMinor: number | null }): number {
  return document.discountedPriceMinor ?? document.priceMinor;
}
