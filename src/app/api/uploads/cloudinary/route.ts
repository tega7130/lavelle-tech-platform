import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { recordAuditEvent } from "@/lib/audit";
import { probeDurationSeconds } from "@/lib/media-probe";
import { Permission } from "@/generated/prisma/client";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Map purpose to required permission, mirrors uploads.ts
const PERMISSION_BY_PURPOSE = {
  programme: Permission.MANAGE_PROGRAMMES,
  finance: Permission.CONFIRM_PAYMENTS,
  certificate: Permission.ISSUE_CERTIFICATES,
  blog: Permission.MANAGE_BLOG,
} as const;

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

export async function POST(req: NextRequest) {
  try {
    // Check authentication and permission
    const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const purpose = (formData.get("purpose") as string) || "programme";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 2 GB limit (${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB)` },
        { status: 400 }
      );
    }

    // Validate purpose
    if (!Object.keys(PERMISSION_BY_PURPOSE).includes(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }

    // Check permission for the specific purpose
    const requiredPermission = PERMISSION_BY_PURPOSE[purpose as keyof typeof PERMISSION_BY_PURPOSE];
    await requireStaffPermission(requiredPermission);

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
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

    const uploadResult = result as any;

    // Probe duration for video/audio
    let durationSeconds: number | null = null;
    if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
      durationSeconds = await probeDurationSeconds(buffer, file.type);
    }

    // Create MediaAsset record
    const asset = await prisma.mediaAsset.create({
      data: {
        kind: file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document",
        storageKey: uploadResult.public_id, // Cloudinary public_id as identifier
        mimeType: file.type,
        bytes: file.size,
        durationSeconds,
        originalFilename: file.name,
        uploadedByStaffId: staff.id,
      },
    });

    // Record audit event
    await recordAuditEvent(prisma, {
      actorStaffId: staff.id,
      subjectType: "media_asset",
      subjectId: asset.id,
      action: "media_asset.uploaded",
      description: `Uploaded video "${file.name}" to Cloudinary`,
    });

    // Return asset with Cloudinary URL
    return NextResponse.json({
      success: true,
      asset: {
        id: asset.id,
        kind: asset.kind,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        bytes: asset.bytes,
        durationSeconds: asset.durationSeconds,
        originalFilename: asset.originalFilename,
        url: uploadResult.secure_url, // Full Cloudinary URL for playback
      },
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
