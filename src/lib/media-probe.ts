import "server-only";
import { parseBuffer } from "music-metadata";

/**
 * Probes real duration from the uploaded bytes — never trust a
 * client-supplied value (rule "Lecture duration is always derived from
 * the uploaded assets"). Returns null (not a guess) when the format
 * can't be probed, which the UI renders as "Duration pending" rather
 * than inventing a number. music-metadata covers audio containers
 * reliably; video container support is best-effort without a native
 * ffprobe binary, which isn't assumed to be present in every environment
 * this runs in — that's a known, documented gap, not silently papered over.
 */
export async function probeDurationSeconds(buffer: Buffer, mimeType: string): Promise<number | null> {
  try {
    const metadata = await parseBuffer(buffer, { mimeType });
    const seconds = metadata.format.duration;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      return Math.round(seconds);
    }
    return null;
  } catch {
    return null;
  }
}
