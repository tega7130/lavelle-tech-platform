export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2GB

export interface CloudinaryUploadResult {
  storageKey: string; // Cloudinary public_id
  bytes: number;
  mimeType: string;
  durationSeconds?: number;
}

/**
 * Upload a file directly to Cloudinary using unsigned upload.
 * Returns the public_id (storageKey) and file metadata.
 */
export async function uploadToCloudinary(
  file: File,
  folder: string
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary credentials not configured");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);
  formData.append("resource_type", "auto");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Upload to Cloudinary failed");
  }

  const result = await response.json();

  return {
    storageKey: result.public_id,
    bytes: result.bytes,
    mimeType: file.type,
    durationSeconds: result.duration || undefined,
  };
}
