"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { recordAuditEvent } from "@/lib/audit";
import { blobExists, blobSize, readBlob } from "@/lib/storage";
import { probeDurationSeconds } from "@/lib/media-probe";

const finaliseUploadSchema = z.object({
  storageKey: z.string().min(1),
  kind: z.enum(["audio", "image", "video", "document"]),
  mimeType: z.string().min(1),
  originalFilename: z.string().min(1),
  // Mirrors /api/uploads/sign's purpose — programme media (default), a
  // finance receipt, or certificate template artwork, each gated by a
  // different permission.
  purpose: z.enum(["programme", "finance", "certificate"]).default("programme"),
});

const PERMISSION_BY_PURPOSE = {
  programme: Permission.MANAGE_PROGRAMMES,
  finance: Permission.CONFIRM_PAYMENTS,
  certificate: Permission.ISSUE_CERTIFICATES,
} as const;

/**
 * Probes duration server-side and creates the MediaAsset — never trusts
 * a client-supplied duration (there is no such field to trust; nothing
 * in this app's UI ever asks the admin to type one).
 */
export async function finaliseUpload(input: unknown) {
  const data = finaliseUploadSchema.parse(input);
  const staff = await requireStaffPermission(PERMISSION_BY_PURPOSE[data.purpose]);

  if (!(await blobExists(data.storageKey))) {
    throw new Error("Upload not found — the presigned URL may have expired before the file finished uploading.");
  }
  const bytes = await blobSize(data.storageKey);

  let durationSeconds: number | null = null;
  if (data.kind === "audio" || data.kind === "video") {
    const buf = await readBlob(data.storageKey);
    durationSeconds = await probeDurationSeconds(buf, data.mimeType);
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      kind: data.kind,
      storageKey: data.storageKey,
      mimeType: data.mimeType,
      bytes,
      durationSeconds,
      originalFilename: data.originalFilename,
      uploadedByStaffId: staff.id,
    },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "media_asset",
    subjectId: asset.id,
    action: "media_asset.uploaded",
    description: `Uploaded ${data.kind} "${data.originalFilename}"`,
  });

  return asset;
}
