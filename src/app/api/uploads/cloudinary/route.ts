import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { Permission } from "@/generated/prisma/client";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PERMISSION_BY_PURPOSE = {
  programme: Permission.MANAGE_PROGRAMMES,
  finance: Permission.CONFIRM_PAYMENTS,
  certificate: Permission.ISSUE_CERTIFICATES,
  blog: Permission.MANAGE_BLOG,
  document_library: Permission.MANAGE_DOCUMENT_LIBRARY,
} as const;

/**
 * Resource type Cloudinary is told to upload each purpose's file as.
 * Left undefined (→ "auto", Cloudinary's own content-sniffing) for
 * purposes that genuinely mix file kinds — "programme" covers lecture
 * video/image/narration uploads, each read back later with the specific
 * resourceType actually stored on that MediaAsset row, not a fixed
 * guess. "document_library" only ever accepts PDF/DOCX (see
 * upload-document-button.tsx's accept attribute) and is always read
 * back with a hardcoded resource_type: "raw" (getSignedAssetUrl calls
 * in document-purchase.ts/document-library.ts) — pinning it here, not
 * leaving it to auto-detection, is what the certificate PDF fix in
 * 9fc406e already established for exactly this failure mode: "auto"
 * guessing wrong at upload time means the signed download URL later
 * requests a resource_type the asset was never actually stored under,
 * a 404 from Cloudinary with nothing in this app's own logs to explain
 * it.
 */
const RESOURCE_TYPE_BY_PURPOSE: Record<string, "image" | "video" | "raw"> = {
  document_library: "raw",
  blog: "image",
  candidate_photo: "image",
};

/**
 * Returns a signed-upload payload for a direct browser → Cloudinary
 * upload — never proxies the file bytes through this app's own
 * serverless function. Vercel's request-body ceiling makes proxying
 * anything beyond a few MB impossible regardless of maxDuration/memory
 * config (the 413 a naive server-side proxy hit on video). No unsigned
 * upload preset exists or is needed: the signature is computed here
 * with the server-only API secret, and only this small JSON payload
 * — never the file itself — passes through Vercel.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const purpose = body?.purpose ?? "programme";

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

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!apiSecret || !apiKey || !cloudName) {
    return NextResponse.json({ error: "Cloudinary credentials not configured" }, { status: 500 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `lavelle/${purpose}`;
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);
  // Not part of the signed params — resource_type is a URL path segment
  // on Cloudinary's own upload endpoint, not a signed body field.
  const resourceType = RESOURCE_TYPE_BY_PURPOSE[purpose] ?? "auto";

  return NextResponse.json({ signature, timestamp, folder, apiKey, cloudName, resourceType });
}
