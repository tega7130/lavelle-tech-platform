export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2GB

export interface CloudinaryUploadResult {
  storageKey: string; // Cloudinary public_id
  bytes: number;
  mimeType: string;
  durationSeconds: number | null;
}

/**
 * Signed direct-to-Cloudinary upload — the file goes straight from the
 * browser to Cloudinary, never through this app's own serverless
 * function (Vercel's request-body ceiling makes proxying video-sized
 * files impossible). /api/uploads/cloudinary only ever returns a small
 * signature (authenticated by staff permission or candidate session,
 * per `purpose`); no unsigned upload preset exists or is needed.
 */
export async function uploadToCloudinary(
  file: File,
  purpose: "programme" | "finance" | "certificate" | "blog" | "candidate_photo"
): Promise<CloudinaryUploadResult> {
  const signRes = await fetch("/api/uploads/cloudinary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose }),
  });
  if (!signRes.ok) {
    const error = await signRes.json().catch(() => ({}));
    throw new Error(error.error || "Could not get an upload authorization.");
  }
  const { signature, timestamp, folder, apiKey, cloudName } = await signRes.json();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });
  if (!uploadRes.ok) {
    const error = await uploadRes.json().catch(() => ({}));
    throw new Error(error.error?.message || "Upload to Cloudinary failed.");
  }
  const result = await uploadRes.json();

  return {
    storageKey: result.public_id,
    bytes: result.bytes,
    mimeType: file.type,
    durationSeconds: typeof result.duration === "number" ? Math.round(result.duration) : null,
  };
}
