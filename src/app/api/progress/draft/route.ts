import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { SubmissionState } from "@/generated/prisma/client";

const bodySchema = z.object({
  enrolmentId: z.string().trim().min(1),
  lectureId: z.string().trim().min(1),
  body: z.string(),
});

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * A route handler, not a Server Action — debounced autosave while the
 * candidate types (rule 12). Same endpoint the offline-drafting-saved-
 * locally flow retries against once connectivity returns; nothing
 * server-side is special-cased for that case, the client just holds the
 * text and retries this call.
 */
export async function POST(request: NextRequest) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { enrolmentId, lectureId, body } = parsed.data;

  const enrolment = await prisma.enrolment.findUnique({ where: { id: enrolmentId } });
  if (!enrolment || enrolment.candidateId !== candidate.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const wordCount = countWords(body);
  const existing = await prisma.draftingSubmission.findFirst({
    where: { enrolmentId, lectureId },
    orderBy: { attemptNumber: "desc" },
  });

  // Already submitted (or itself returned/superseded) — autosave has
  // nothing to write to. RESUBMITTED is still being written, same as
  // DRAFT — it just marks that this attempt exists because a prior one
  // was referred.
  if (existing && existing.state !== SubmissionState.DRAFT && existing.state !== SubmissionState.RESUBMITTED) {
    return NextResponse.json({ ok: true, saved: false });
  }

  if (existing) {
    await prisma.draftingSubmission.update({ where: { id: existing.id }, data: { body, wordCount } });
  } else {
    await prisma.draftingSubmission.create({
      data: { enrolmentId, lectureId, body, wordCount, state: SubmissionState.DRAFT },
    });
  }

  return NextResponse.json({ ok: true, saved: true, wordCount });
}
