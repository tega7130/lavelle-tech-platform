import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { saveLectureNote } from "@/lib/player-actions";

const bodySchema = z.object({
  enrolmentId: z.string().trim().min(1),
  lectureId: z.string().trim().min(1),
  body: z.string(),
});

/**
 * A route handler, not a Server Action — debounced autosave while the
 * candidate types, same shape as /api/progress/position (thin delegate to
 * a testable lib function, not inline Prisma calls). body is always the
 * rich text editor's serialized markup, never HTML — see src/lib/rich-text.ts.
 */
export async function POST(request: NextRequest) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { enrolmentId, lectureId, body } = parsed.data;

  try {
    await saveLectureNote(candidate.id, enrolmentId, lectureId, body);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
