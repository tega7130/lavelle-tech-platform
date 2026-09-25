import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { createUploadUrl } from "@/lib/storage";
import { Permission } from "@/generated/prisma/client";

const PERMISSION_BY_PURPOSE = {
  programme: Permission.MANAGE_PROGRAMMES,
  finance: Permission.CONFIRM_PAYMENTS,
  certificate: Permission.ISSUE_CERTIFICATES,
  blog: Permission.MANAGE_BLOG,
  document_library: Permission.MANAGE_DOCUMENT_LIBRARY,
} as const;

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  programme: ["video/mp4", "video/webm", "video/quicktime", "image/jpeg", "image/png", "image/webp"],
  blog: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  certificate: ["application/pdf"],
  document_library: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-word.document.macroEnabled.12"],
  finance: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  candidate_photo: ["image/jpeg", "image/png", "image/webp"],
};

const EXTENSION_BY_MIME_TYPE: Record<string, string[]> = {
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov", "qt"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-word.document.macroEnabled.12": ["docm"],
};

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function isValidMimeTypeAndExtension(mimeType: string, filename: string): boolean {
  const ext = getFileExtension(filename);
  if (!ext) return false;

  const validExtensions = EXTENSION_BY_MIME_TYPE[mimeType];
  if (!validExtensions) return false;

  return validExtensions.includes(ext);
}

/**
 * Returns a signed PUT URL for a direct browser → Spaces upload — never
 * proxies the file bytes through this app's own serverless function.
 * Vercel's request-body ceiling makes proxying anything beyond a few MB
 * impossible regardless of maxDuration/memory config (the 413 a naive
 * server-side proxy hit on video).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const purpose = body?.purpose ?? "programme";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : null;
  const originalFilename = typeof body?.originalFilename === "string" ? body.originalFilename : "upload";

  if (!mimeType) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (purpose === "candidate_photo") {
    const candidate = await getCurrentCandidate();
    if (!candidate) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else {
    if (!(purpose in PERMISSION_BY_PURPOSE)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    try {
      await requireStaffPermission(PERMISSION_BY_PURPOSE[purpose as keyof typeof PERMISSION_BY_PURPOSE]);
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // Validate MIME type is allowed for this purpose
  const allowedTypes = ALLOWED_MIME_TYPES[purpose];
  if (!allowedTypes || !allowedTypes.includes(mimeType)) {
    return NextResponse.json(
      { error: "invalid_content_type", message: `${mimeType} is not allowed for this upload type` },
      { status: 400 }
    );
  }

  // Validate file extension matches MIME type
  if (!isValidMimeTypeAndExtension(mimeType, originalFilename)) {
    return NextResponse.json(
      { error: "invalid_file_extension", message: "File extension does not match the declared MIME type" },
      { status: 400 }
    );
  }

  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `lavelle/${purpose}/${crypto.randomUUID()}-${safeFilename}`;
  const uploadUrl = await createUploadUrl(storageKey, mimeType, 300);

  return NextResponse.json({ uploadUrl, storageKey });
}
