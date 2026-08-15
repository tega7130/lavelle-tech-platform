import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { Permission } from "@/generated/prisma/client";
import { createPresignedUpload, MAX_UPLOAD_BYTES } from "@/lib/storage";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB — a profile photo, not a lecture asset

const bodySchema = z.object({
  kind: z.enum(["audio", "image", "video", "document"]),
  mimeType: z.string().min(1),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  // Which permission gates this upload — programme media (Slice 02,
  // default, preserves every existing caller unchanged), a finance
  // receipt (Slice 03: offline-payment recording), certificate template
  // artwork (Slice 07), or a candidate's own profile photo (candidate-
  // gated, not staff-gated — the only purpose below with no staff
  // permission at all).
  purpose: z.enum(["programme", "finance", "certificate", "candidate_photo"]).default("programme"),
});

const PERMISSION_BY_PURPOSE = {
  programme: Permission.MANAGE_PROGRAMMES,
  finance: Permission.CONFIRM_PAYMENTS,
  certificate: Permission.ISSUE_CERTIFICATES,
} as const;

/**
 * A route handler, not a Server Action — audio/video exceed the Server
 * Action body limit and would fail in production. This only ever returns
 * a presigned PUT; the actual bytes go straight from the browser to
 * storage (PUT /api/uploads/blob/...), never through this app's Server
 * Action pipeline.
 */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.purpose === "candidate_photo") {
    if (parsed.data.kind !== "image" || parsed.data.bytes > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    const candidate = await getCurrentCandidate();
    if (!candidate) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else {
    try {
      await requireStaffPermission(PERMISSION_BY_PURPOSE[parsed.data.purpose]);
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(createPresignedUpload(parsed.data));
}
