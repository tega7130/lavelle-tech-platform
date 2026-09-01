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

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB — a profile photo, not a lecture asset

/**
 * Server-signed Cloudinary upload — the counterpart to the old presigned-
 * blob flow. No unsigned upload preset is configured (or needed): the
 * browser posts the file here, this route authenticates the caller (staff
 * permission or candidate session, matching /api/uploads/sign's purpose
 * gating) and forwards to Cloudinary using the server-only API secret.
 * Does NOT create the MediaAsset row itself — callers still finish with
 * finaliseUpload/finaliseCandidatePhotoUpload, same two-step shape as
 * every other upload path in this app.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const purpose = (formData.get("purpose") as string) || "programme";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (purpose === "candidate_photo") {
      if (!file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      }
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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 2 GB limit (${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB)` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `lavelle/${purpose}`,
          resource_type: "auto",
          original_filename: file.name,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({
      storageKey: uploadResult.public_id,
      bytes: uploadResult.bytes as number,
      mimeType: file.type,
      durationSeconds: typeof uploadResult.duration === "number" ? Math.round(uploadResult.duration) : null,
      originalFilename: file.name,
      url: uploadResult.secure_url as string,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
