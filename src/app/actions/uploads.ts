"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { recordAuditEvent } from "@/lib/audit";
import { blobExists, blobSize, readBlob } from "@/lib/storage";
import { probeDurationSeconds } from "@/lib/media-probe";

const finaliseUploadSchema = z.object({
  storageKey: z.string().min(1),
  kind: z.enum(["audio", "image", "video", "document"]),
  mimeType: z.string().min(1),
  originalFilename: z.string().min(1),
  // Mirrors /api/uploads/sign's purpose — programme media (default), a
  // finance receipt, certificate template artwork, or a blog post hero
  // image, each gated by a different permission.
  purpose: z.enum(["programme", "finance", "certificate", "blog"]).default("programme"),
});

const PERMISSION_BY_PURPOSE = {
  programme: Permission.MANAGE_PROGRAMMES,
  finance: Permission.CONFIRM_PAYMENTS,
  certificate: Permission.ISSUE_CERTIFICATES,
  blog: Permission.MANAGE_BLOG,
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

const finaliseCandidatePhotoSchema = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  originalFilename: z.string().min(1),
});

/**
 * The candidate-facing counterpart to finaliseUpload — same verify-blob-
 * then-create-MediaAsset shape, but candidate-gated instead of staff-
 * permission-gated, and it also writes the resulting storage key onto
 * CandidateProfile.photoUrl in the same call (the one write path for a
 * candidate's own photo, mirroring updateProfile's single-write-path
 * rule). photoUrl holds a storage key, never a signed URL — a signed GET
 * URL expires in minutes and must be regenerated fresh at render time.
 */
export async function finaliseCandidatePhotoUpload(input: unknown) {
  const data = finaliseCandidatePhotoSchema.parse(input);
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("You must be signed in.");
  if (!data.mimeType.startsWith("image/")) throw new Error("Profile photos must be an image file.");

  if (!(await blobExists(data.storageKey))) {
    throw new Error("Upload not found — the presigned URL may have expired before the file finished uploading.");
  }
  const bytes = await blobSize(data.storageKey);

  const asset = await prisma.mediaAsset.create({
    data: {
      kind: "image",
      storageKey: data.storageKey,
      mimeType: data.mimeType,
      bytes,
      originalFilename: data.originalFilename,
      uploadedByCandidateId: candidate.id,
    },
  });

  await prisma.candidateProfile.upsert({
    where: { candidateId: candidate.id },
    create: { candidateId: candidate.id, photoUrl: data.storageKey },
    update: { photoUrl: data.storageKey },
  });

  await recordAuditEvent(prisma, {
    subjectType: "candidate",
    subjectId: candidate.id,
    action: "candidate.photo_uploaded",
    description: "Uploaded a new profile photo",
  });

  return asset;
}
