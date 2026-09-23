export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2GB

export interface StorageUploadResult {
  storageKey: string;
  bytes: number;
  mimeType: string;
  durationSeconds: number | null;
}

/**
 * Signed direct-to-Spaces upload — the file goes straight from the
 * browser to storage, never through this app's own serverless function
 * (Vercel's request-body ceiling makes proxying video-sized files
 * impossible). /api/uploads/storage only ever returns a short-lived
 * signed PUT URL (authenticated by staff permission or candidate session,
 * per `purpose`); the file bytes never pass through this app's server.
 *
 * durationSeconds is always null here — Spaces doesn't probe media the
 * way Cloudinary's upload response used to. Callers that need it (video/
 * audio uploads) read it from the browser's own <video>/<audio> metadata
 * before calling this function and pass it through separately.
 */
export async function uploadToStorage(
  file: File,
  purpose: "programme" | "finance" | "certificate" | "blog" | "candidate_photo" | "document_library",
  kind?: "audio" | "video" | "image" | "document"
): Promise<StorageUploadResult> {
  const signRes = await fetch("/api/uploads/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, kind, mimeType: file.type, originalFilename: file.name }),
  });
  if (!signRes.ok) {
    const error = await signRes.json().catch(() => ({}));
    throw new Error(error.error || "Could not get an upload authorization.");
  }
  const { uploadUrl, storageKey } = await signRes.json();

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Upload failed.");
  }

  return {
    storageKey,
    bytes: file.size,
    mimeType: file.type,
    durationSeconds: null,
  };
}

/** Probes a video/audio file's duration client-side, from the browser's own media metadata — the replacement for Cloudinary's upload-response duration. Returns null if the browser can't decode the file. */
export function probeMediaDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(el.src);
      resolve(Number.isFinite(el.duration) && el.duration > 0 ? Math.round(el.duration) : null);
    };
    el.onerror = () => {
      URL.revokeObjectURL(el.src);
      resolve(null);
    };
    el.src = URL.createObjectURL(file);
  });
}
