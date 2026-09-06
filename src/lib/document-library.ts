// Document Library (Phase 1) — shared vocabulary between the admin form,
// the table and both validation layers, so there is exactly one place a
// new category or accepted file type gets added.

export interface DocumentCategoryOption {
  value: string;
  label: string;
}

// A starting list, not a closed set (see DocumentTemplate.category's
// comment in schema.prisma) — plain strings, so adding one later is a
// one-line change here, never a migration.
export const DOCUMENT_CATEGORIES: DocumentCategoryOption[] = [
  { value: "CONTRACTS", label: "Contracts" },
  { value: "MOUS", label: "MOUs" },
  { value: "AGREEMENTS", label: "Agreements" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "OTHER", label: "Other" },
];

export const DOCUMENT_CATEGORY_VALUES = DOCUMENT_CATEGORIES.map((c) => c.value) as [string, ...string[]];

export function documentCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

// PDF and DOCX only, per spec — keyed by the MIME type Cloudinary reports
// back at upload time (never trusted from the client's <input accept>
// alone; see finaliseUpload's purpose === "document_library" branch).
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
