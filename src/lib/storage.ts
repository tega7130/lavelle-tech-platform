import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Local dev storage shim. No real object-storage account is configured
 * for this environment, so uploads land on local disk under
 * .local-storage/ (gitignored) instead of S3/R2/etc — but the CONTRACT
 * is the real one: a presigned PUT for the upload, a signed and expiring
 * URL for every read, storageKey never a public URL (rule 10/11). Swap
 * writeBlob/readBlob and the sign-and-verify helpers for a real
 * provider's SDK without touching any caller — createPresignedUpload,
 * getSignedAssetUrl and finaliseUpload's shape all stay the same.
 */

const STORAGE_ROOT = path.join(process.cwd(), ".local-storage");
const UPLOAD_WINDOW_MS = 15 * 60 * 1000; // presigned PUT is valid for 15 minutes
const READ_TTL_SECONDS = 300; // signed GET is valid for 5 minutes

function secret() {
  const s = process.env.UPLOAD_SIGNING_SECRET;
  if (!s) throw new Error("UPLOAD_SIGNING_SECRET is not set");
  return s;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2GB — matches the design copy's "MP4 up to 2GB"

export interface PresignedUpload {
  storageKey: string;
  uploadUrl: string;
  method: "PUT";
  expiresAt: string;
}

/** `POST /api/uploads/sign` — a presigned PUT the client uploads straight to, never through a Server Action (rule 10). */
export function createPresignedUpload(params: { kind: string; mimeType: string; bytes: number }): PresignedUpload {
  if (params.bytes <= 0 || params.bytes > MAX_UPLOAD_BYTES) {
    throw new Error(`bytes must be between 1 and ${MAX_UPLOAD_BYTES}`);
  }
  const ext = EXT_BY_MIME[params.mimeType] ?? "bin";
  const storageKey = `uploads/${crypto.randomUUID()}.${ext}`;
  const expiresAt = Date.now() + UPLOAD_WINDOW_MS;
  const sig = sign(`PUT:${storageKey}:${expiresAt}`);
  return {
    storageKey,
    uploadUrl: `/api/uploads/blob/${storageKey}?exp=${expiresAt}&sig=${sig}`,
    method: "PUT",
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

/** A fresh signed, expiring URL for reading previously-uploaded content — content is never reachable any other way (rule 10/11). */
export function getSignedAssetUrl(storageKey: string, ttlSeconds = READ_TTL_SECONDS): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const sig = sign(`GET:${storageKey}:${expiresAt}`);
  return `/api/uploads/blob/${storageKey}?exp=${expiresAt}&sig=${sig}`;
}

export function verifyBlobSignature(
  storageKey: string,
  method: "PUT" | "GET",
  exp: string | null,
  sig: string | null
): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false;
  return safeEqual(sig, sign(`${method}:${storageKey}:${exp}`));
}

function resolvePath(storageKey: string): string {
  const resolved = path.normalize(path.join(STORAGE_ROOT, storageKey));
  const root = path.normalize(STORAGE_ROOT + path.sep);
  if (!resolved.startsWith(root)) throw new Error("Invalid storage key");
  return resolved;
}

export async function writeBlob(storageKey: string, data: Buffer): Promise<void> {
  const filePath = resolvePath(storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

export async function readBlob(storageKey: string): Promise<Buffer> {
  return fs.readFile(resolvePath(storageKey));
}

export async function blobExists(storageKey: string): Promise<boolean> {
  try {
    await fs.access(resolvePath(storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function blobSize(storageKey: string): Promise<number> {
  const stat = await fs.stat(resolvePath(storageKey));
  return stat.size;
}
