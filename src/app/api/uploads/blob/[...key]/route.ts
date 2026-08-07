import { NextRequest, NextResponse } from "next/server";
import { verifyBlobSignature, writeBlob, readBlob, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

/**
 * The local dev storage shim's actual blob store (src/lib/storage.ts).
 * Every request here — PUT to upload, GET to serve — must carry a valid,
 * unexpired signature; there is no other way to reach this content
 * (rule: "content served signed and expiring", "a permanent public
 * object URL is how the product leaks").
 */

async function keyFrom(params: Promise<{ key: string[] }>) {
  const { key } = await params;
  return key.join("/");
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const storageKey = await keyFrom(params);
  const { searchParams } = request.nextUrl;
  if (!verifyBlobSignature(storageKey, "PUT", searchParams.get("exp"), searchParams.get("sig"))) {
    return NextResponse.json({ error: "invalid_or_expired_signature" }, { status: 403 });
  }

  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "invalid_size" }, { status: 400 });
  }

  await writeBlob(storageKey, buf);
  return NextResponse.json({ ok: true, storageKey, bytes: buf.byteLength });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const storageKey = await keyFrom(params);
  const { searchParams } = request.nextUrl;
  if (!verifyBlobSignature(storageKey, "GET", searchParams.get("exp"), searchParams.get("sig"))) {
    return NextResponse.json({ error: "invalid_or_expired_signature" }, { status: 403 });
  }

  let buf: Buffer;
  try {
    buf = await readBlob(storageKey);
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const asset = await prisma.mediaAsset.findUnique({ where: { storageKey } });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": asset?.mimeType ?? "application/octet-stream",
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "private, max-age=60",
    },
  });
}
