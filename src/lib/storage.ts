import "server-only";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2GB

export interface CloudinaryUploadToken {
  cloudName: string;
  uploadPreset: string;
  apiKey: string;
  maxFileSize: number;
}

export interface PresignedUpload {
  cloudName: string;
  uploadPreset: string;
  apiKey: string;
  maxFileSize: number;
  folder: string;
}

export function createPresignedUpload(params: { kind: string; mimeType: string; bytes: number }): PresignedUpload {
  if (params.bytes <= 0 || params.bytes > MAX_UPLOAD_BYTES) {
    throw new Error(`bytes must be between 1 and ${MAX_UPLOAD_BYTES}`);
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) throw new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set");

  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!uploadPreset) throw new Error("NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET is not set");

  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_CLOUDINARY_API_KEY is not set");

  return {
    cloudName,
    uploadPreset,
    apiKey,
    maxFileSize: MAX_UPLOAD_BYTES,
    folder: `lavelle/${params.kind}`,
  };
}

export type CloudinaryResourceType = "image" | "video" | "raw";

// MediaAsset.kind ("audio" | "image" | "video" | "document") to Cloudinary's
// own resource_type ("image" | "video" | "raw") — Cloudinary has no
// separate "audio" resource type; audio files live under "video".
export function resourceTypeForKind(kind: string): CloudinaryResourceType {
  if (kind === "video" || kind === "audio") return "video";
  if (kind === "document") return "raw";
  return "image";
}

/**
 * type: "upload" here must match the delivery type actually used at
 * upload time (uploadToCloudinary / /api/uploads/cloudinary, which don't
 * set `type`, so Cloudinary defaults new uploads to "upload"). Signing
 * this as "authenticated" instead — a different delivery type, not just a
 * stricter mode of the same one — points at a resource Cloudinary can't
 * find, which is why every uploaded video got stuck "loading" forever.
 */
export function getSignedAssetUrl(storageKey: string, resourceType: CloudinaryResourceType = "image", ttlSeconds = 300): string {
  return cloudinary.url(storageKey, {
    secure: true,
    sign_url: true,
    type: "upload",
    resource_type: resourceType,
    expiration: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}
