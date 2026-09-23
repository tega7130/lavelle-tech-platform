import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: process.env.DO_SPACES_REGION || "us-east-1", // Spaces ignores the value but the SDK requires one set
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  // The SDK's default ("WHEN_SUPPORTED") signs an x-amz-sdk-checksum-algorithm
  // param into every presigned PUT URL. Spaces doesn't support that extension,
  // so the browser's direct upload fails outright (CORS-looking "Failed to
  // fetch", since Spaces' rejection response carries no CORS headers). This
  // restores pre-2024 behaviour: only checksum when an operation requires it.
  requestChecksumCalculation: "WHEN_REQUIRED",
});

function bucket(): string {
  const name = process.env.DO_SPACES_BUCKET;
  if (!name) throw new Error("DO_SPACES_BUCKET is not set");
  return name;
}

export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2GB

/**
 * Signed PUT URL — the browser uploads directly to Spaces, never through
 * this app's own serverless function (Vercel's request-body ceiling makes
 * proxying video-sized files impossible).
 */
export async function createUploadUrl(storageKey: string, mimeType: string, ttlSeconds = 300): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket(), Key: storageKey, ContentType: mimeType });
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds });
}

/** Fresh signed URLs for whatever assets a lecture/slide references — content is never reachable any other way. */
export async function getSignedAssetUrl(
  storageKey: string,
  ttlSeconds = 300,
  /** Forces a Content-Disposition: attachment response — used by document Download (as opposed to View Online, which wants the browser's default inline/viewer behaviour). */
  forceDownload = false
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: storageKey,
    ...(forceDownload ? { ResponseContentDisposition: "attachment" } : {}),
  });
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds });
}

/** Server-side upload of bytes already in memory — certificate PDFs, generated server-side rather than uploaded from a browser. */
export async function putObject(storageKey: string, body: Buffer, mimeType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: storageKey, Body: body, ContentType: mimeType }));
}

/** Server-side read of the full object body — used where this app already runs on the server and a signed round-trip would be pointless (the certificate PDF route). */
export async function getObjectBytes(storageKey: string): Promise<Buffer> {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: storageKey }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}
