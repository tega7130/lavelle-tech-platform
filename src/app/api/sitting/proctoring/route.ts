import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { logProctoringEvent, NotYourSittingError } from "@/lib/exam-sitting-actions";

const bodySchema = z.object({
  sittingId: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  detail: z.record(z.string(), z.unknown()).optional(),
});

/** Fire-and-forget from beacon/fetch on fullscreen-exit and visibilitychange — never blocks the candidate's own flow. */
export async function POST(request: NextRequest) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    await logProctoringEvent(parsed.data.sittingId, candidate.id, parsed.data.kind, parsed.data.detail);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotYourSittingError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
