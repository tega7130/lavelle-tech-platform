export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2GB

export interface CloudinaryUploadResult {
  storageKey: string; // Cloudinary public_id
  bytes: number;
  mimeType: string;
  durationSeconds: number | null;
}

/**
 * Uploads via /api/uploads/cloudinary — a server-signed proxy, not a
 * direct-to-Cloudinary unsigned upload. There is no unsigned upload
 * preset configured (or needed): only the server-only CLOUDINARY_API_KEY
 * / CLOUDINARY_API_SECRET exist, so the browser posts the file to this
 * app's own route, which authenticates the caller (staff permission or
 * candidate session, by `purpose`) and forwards to Cloudinary itself.
 */
export async function uploadToCloudinary(
  file: File,
  purpose: "programme" | "finance" | "certificate" | "blog" | "candidate_photo"
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);

  const response = await fetch("/api/uploads/cloudinary", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Upload failed.");
  }

  const result = await response.json();

  return {
    storageKey: result.storageKey,
    bytes: result.bytes,
    mimeType: result.mimeType,
    durationSeconds: result.durationSeconds ?? null,
  };
}
