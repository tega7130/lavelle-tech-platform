import { detectFaststart, blobRangeReader } from "@/lib/mp4-boxes";

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

const PDF_RASTER_TARGET_WIDTH = 1600;

/**
 * Renders a PDF's first page to a PNG File, entirely in the browser — the
 * only reliable way to show a candidate a slide's PDF content without the
 * browser's own PDF-viewer chrome (toolbar, zoom, download, print). Modern
 * Chrome no longer honours the classic `#toolbar=0` open-parameter trick for
 * an iframe-embedded PDF (it was deprecated for phishing-safety reasons), so
 * suppressing that chrome client-side isn't possible — converting to an
 * image upstream, once, at upload time, sidesteps the native viewer
 * entirely and reuses the image-slide path that already renders edge-to-
 * edge with no chrome of any kind.
 */
export async function rasterizePdfFirstPage(file: File): Promise<File> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);

  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = PDF_RASTER_TARGET_WIDTH / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the PDF for conversion.");

  const renderTask = page.render({ canvasContext: context, viewport, canvas });
  // pdf.js's render loop is tied to the page actually painting — a
  // backgrounded/minimized tab (or a throttled browser context) can leave
  // this promise pending indefinitely with no error of its own. Surfacing
  // a clear, actionable failure beats leaving an admin staring at
  // "Converting PDF…" forever with no way out.
  await Promise.race([
    renderTask.promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        renderTask.cancel();
        reject(new Error("Converting that PDF took too long — try exporting the slide as an image instead."));
      }, 20_000)
    ),
  ]);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not convert the PDF page to an image.");

  const name = file.name.replace(/\.pdf$/i, "") + ".png";
  return new File([blob], name, { type: "image/png" });
}

/** False when an MP4/MOV's index sits after its media data, which makes playback slow to start. */
export async function checkVideoFaststart(file: File): Promise<boolean | null> {
  if (file.type !== "video/mp4" && file.type !== "video/quicktime") return null;
  try {
    return (await detectFaststart(blobRangeReader(file), file.size)).faststart;
  } catch {
    return null;
  }
}
