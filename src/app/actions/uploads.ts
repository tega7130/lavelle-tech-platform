"use server";

import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { recordAuditEvent } from "@/lib/audit";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const finaliseUploadSchema = z.object({
  storageKey: z.string().min(1),
  kind: z.enum(["audio", "image", "video", "document"]),
  mimeType: z.string().min(1),
  originalFilename: z.string().min(1),
  bytes: z.number().int().positive(),
  durationSeconds: z.number().nonnegative().nullable(),
  purpose: z.enum(["programme", "finance", "certificate", "blog"]).default("programme"),
});

const PERMISSION_BY_PURPOSE = {
  programme: Permission.MANAGE_PROGRAMMES,
  finance: Permission.CONFIRM_PAYMENTS,
  certificate: Permission.ISSUE_CERTIFICATES,
  blog: Permission.MANAGE_BLOG,
} as const;

export async function finaliseUpload(input: unknown) {
  const data = finaliseUploadSchema.parse(input);
  const staff = await requireStaffPermission(PERMISSION_BY_PURPOSE[data.purpose]);

  const asset = await prisma.mediaAsset.create({
    data: {
      kind: data.kind,
      storageKey: data.storageKey,
      mimeType: data.mimeType,
      bytes: data.bytes,
      durationSeconds: data.durationSeconds,
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
  bytes: z.number().int().positive(),
});

export async function finaliseCandidatePhotoUpload(input: unknown) {
  const data = finaliseCandidatePhotoSchema.parse(input);
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("You must be signed in.");
  if (!data.mimeType.startsWith("image/")) throw new Error("Profile photos must be an image file.");

  const asset = await prisma.mediaAsset.create({
    data: {
      kind: "image",
      storageKey: data.storageKey,
      mimeType: data.mimeType,
      bytes: data.bytes,
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
