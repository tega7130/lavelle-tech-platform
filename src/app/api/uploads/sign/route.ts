import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { createPresignedUpload, MAX_UPLOAD_BYTES } from "@/lib/storage";

const bodySchema = z.object({
  kind: z.enum(["audio", "image", "video", "document"]),
  mimeType: z.string().min(1),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/**
 * A route handler, not a Server Action — audio/video exceed the Server
 * Action body limit and would fail in production. This only ever returns
 * a presigned PUT; the actual bytes go straight from the browser to
 * storage (PUT /api/uploads/blob/...), never through this app's Server
 * Action pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  return NextResponse.json(createPresignedUpload(parsed.data));
}
