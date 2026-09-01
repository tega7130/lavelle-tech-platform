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
} as const;

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

  return NextResponse.json({ signature, timestamp, folder, apiKey, cloudName });
}
