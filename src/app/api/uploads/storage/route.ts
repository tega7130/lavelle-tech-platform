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

  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `lavelle/${purpose}/${crypto.randomUUID()}-${safeFilename}`;
  const uploadUrl = await createUploadUrl(storageKey, mimeType, 300);

  return NextResponse.json({ uploadUrl, storageKey });
}
