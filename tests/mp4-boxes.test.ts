import { describe, it, expect } from "vitest";
import { detectFaststart, blobRangeReader, type RangeReader } from "@/lib/mp4-boxes";

function box(type: string, payloadBytes: number): Uint8Array {
  const out = new Uint8Array(8 + payloadBytes);
  new DataView(out.buffer).setUint32(0, out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  return out;
}

function largeBox(type: string, declaredSize: bigint): Uint8Array {
  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  view.setUint32(0, 1);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  view.setBigUint64(8, declaredSize);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function reader(bytes: Uint8Array): RangeReader {
  return async (start, length) => bytes.slice(start, start + length);
}

describe("detectFaststart — is moov ahead of mdat?", () => {
  it("reports faststart when moov precedes mdat", async () => {
    const file = concat(box("ftyp", 16), box("moov", 100), box("mdat", 500));
    expect(await detectFaststart(reader(file), file.length)).toEqual({ faststart: true, boxes: ["ftyp", "moov"] });
  });

  it("reports not-faststart when mdat comes first", async () => {
    const file = concat(box("ftyp", 16), box("free", 0), box("mdat", 500), box("moov", 100));
    expect(await detectFaststart(reader(file), file.length)).toEqual({ faststart: false, boxes: ["ftyp", "free", "mdat"] });
  });

  it("follows a 64-bit largesize box without reading its payload", async () => {
    // Must jump by the 64-bit size, not the 32-bit field (1), to land on moov.
    const ftyp = box("ftyp", 16);
    const wide = largeBox("wide", BigInt(32));
    const file = concat(ftyp, wide, new Uint8Array(16), box("moov", 8));
    expect((await detectFaststart(reader(file), file.length)).faststart).toBe(true);
  });

  it("returns null for truncated or non-MP4 input", async () => {
    expect((await detectFaststart(reader(new Uint8Array(4)), 4)).faststart).toBeNull();
    const garbage = new Uint8Array(64).fill(0xff);
    expect((await detectFaststart(reader(garbage), garbage.length)).faststart).toBeNull();
  });

  it("works over a Blob via blobRangeReader", async () => {
    const file = concat(box("ftyp", 16), box("mdat", 32), box("moov", 8));
    const blob = new Blob([file as BlobPart]);
    expect((await detectFaststart(blobRangeReader(blob), blob.size)).faststart).toBe(false);
  });
});
