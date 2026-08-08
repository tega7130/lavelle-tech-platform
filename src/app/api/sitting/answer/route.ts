import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { saveSittingAnswer, NotYourSittingError, SittingExpiredError } from "@/lib/exam-sitting-actions";

const bodySchema = z.object({
  sittingId: z.string().trim().min(1),
  questionId: z.string().trim().min(1),
  selectedOptionId: z.string().trim().min(1).nullable().optional(),
  writtenAnswer: z.string().nullable().optional(),
  flagged: z.boolean().optional(),
});

/**
 * Autosave, every answer (rule 5) — a route handler, not a Server
 * Action, so it can be fired from a beforeunload/pagehide handler the
 * same way the drafting exercise's autosave is. Rejects with 409 once
 * expiresAt has passed (rule 4/7) — the client's own countdown is
 * cosmetic, this is the enforcement.
 */
export async function POST(request: NextRequest) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    await saveSittingAnswer(parsed.data.sittingId, candidate.id, {
      questionId: parsed.data.questionId,
      selectedOptionId: parsed.data.selectedOptionId,
      writtenAnswer: parsed.data.writtenAnswer,
      flagged: parsed.data.flagged,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof NotYourSittingError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (e instanceof SittingExpiredError) return NextResponse.json({ error: "expired" }, { status: 409 });
    return NextResponse.json({ error: "not_in_progress" }, { status: 409 });
  }
}
