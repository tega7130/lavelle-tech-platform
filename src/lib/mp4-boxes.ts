// Checks whether an MP4/MOV is "faststart" (moov index before mdat) by reading only box headers.

export type RangeReader = (start: number, length: number) => Promise<Uint8Array>;

export interface FaststartResult {
  /** null when the file couldn't be parsed. */
  faststart: boolean | null;
  /** Top-level box types seen, in order. */
  boxes: string[];
}

const MAX_BOXES = 64;

export async function detectFaststart(read: RangeReader, totalSize: number): Promise<FaststartResult> {
  const boxes: string[] = [];
  let offset = 0;

  while (offset + 8 <= totalSize && boxes.length < MAX_BOXES) {
    const header = await read(offset, Math.min(16, totalSize - offset));
    if (header.length < 8) break;
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);

    let size = view.getUint32(0);
    const type = String.fromCharCode(header[4]!, header[5]!, header[6]!, header[7]!);
    if (size === 1) {
      // 64-bit size follows the type (files over 4GB).
      if (header.length < 16) break;
      size = Number(view.getBigUint64(8));
    } else if (size === 0) {
      // Box runs to end of file.
      size = totalSize - offset;
    }
    if (size < 8) break;

    boxes.push(type);
    if (type === "moov") return { faststart: true, boxes };
    if (type === "mdat") return { faststart: false, boxes };
    offset += size;
  }

  return { faststart: null, boxes };
}

/** Range reader over a browser File/Blob. */
export function blobRangeReader(blob: Blob): RangeReader {
  return async (start, length) => new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
}
