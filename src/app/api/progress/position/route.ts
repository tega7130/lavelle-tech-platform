import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { savePosition, recordVideoWatchProgress } from "@/lib/player-actions";

const bodySchema = z.object({
  enrolmentId: z.string().trim().min(1),
  lectureId: z.string().trim().min(1),
  slideIndex: z.number().int().min(0).optional(),
  mediaPositionSeconds: z.number().int().min(0).optional(),
  mediaDurationSeconds: z.number().int().min(0).optional(),
});

/**
 * A route handler, not a Server Action — called via sendBeacon on unload
 * as well as a throttled fetch during playback (README: throttled to
 * roughly every 10 seconds, never fired per interaction), and
 * sendBeacon can only POST to a plain URL. The actual writes live in
 * src/lib/player-actions.ts's savePosition (resume cursor) and
 * recordVideoWatchProgress (engagement — how far the candidate has ever
 * gotten, for analytics) — extracted so they're testable without a live
 * request context. recordVideoWatchProgress only runs alongside a video
 * position (mediaPositionSeconds set) — a slide lecture's position save
 * never carries one, so it never creates a watch-progress row.
 */
export async function POST(request: NextRequest) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { enrolmentId, lectureId, slideIndex, mediaPositionSeconds, mediaDurationSeconds } = parsed.data;

  try {
    await savePosition(candidate.id, enrolmentId, lectureId, { slideIndex, mediaPositionSeconds });
    if (mediaPositionSeconds != null) {
      await recordVideoWatchProgress(candidate.id, enrolmentId, lectureId, {
        positionSeconds: mediaPositionSeconds,
        durationSeconds: mediaDurationSeconds,
      });
    }
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
