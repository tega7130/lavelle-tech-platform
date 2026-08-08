import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { computeFinalMark, resolveGradeBand, average } from "@/lib/grading";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Idempotent — safe to call on every mark return (and, once Slice 06
 * exists, on examination release; there is no call site for that yet).
 * Materialises ProgrammeResult with a weightingSnapshot (rule 3/11), since
 * this is cited on a certificate that outlives the programme's weighting.
 */
export async function recomputeProgrammeResult(enrolmentId: string, db: Db = prisma) {
  const enrolment = await db.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } });

  // Quiz average — the latest SUBMITTED attempt per quiz, not every
  // retake, so a candidate who retook a quiz isn't penalised by an early
  // poor attempt still sitting in the average.
  const quizAttempts = await db.quizAttempt.findMany({
    where: { enrolmentId, submittedAt: { not: null } },
    orderBy: { attemptNumber: "desc" },
  });
  const latestByQuiz = new Map<string, number>();
  for (const a of quizAttempts) {
    if (!latestByQuiz.has(a.quizId) && a.scorePercent != null) latestByQuiz.set(a.quizId, a.scorePercent);
  }
  const quizAveragePercent = average([...latestByQuiz.values()]);

  // Drafting average — the latest RETURNED mark per lecture. A referral
  // followed by a passing resubmission counts once, at its final outcome
  // (rule 4/README "the record must show both the referral and its
  // remedy" — that's what the two Mark rows are for; the average reflects
  // only where the candidate landed).
  const draftingMarks = await db.mark.findMany({
    where: { enrolmentId, kind: "DRAFTING", state: "RETURNED", draftingSubmission: { isNot: null } },
    include: { draftingSubmission: true },
    orderBy: { draftingSubmission: { attemptNumber: "desc" } },
  });
  const latestByLecture = new Map<string, number>();
  for (const m of draftingMarks) {
    const lectureId = m.draftingSubmission!.lectureId;
    if (!latestByLecture.has(lectureId) && m.scorePercent != null) latestByLecture.set(lectureId, m.scorePercent);
  }
  const draftingAveragePercent = average([...latestByLecture.values()]);

  // Examination — Slice 06's territory; this slice never has one to read.
  const examinationPercent: number | null = null;

  const weightingRows = await db.assessmentWeighting.findMany({ where: { programmeId: enrolment.programmeId } });
  const weights = { QUIZ: 0, DRAFTING: 0, EXAMINATION: 0 };
  for (const w of weightingRows) weights[w.kind] = w.weightPercent;

  const { finalPercent, isProvisional } = computeFinalMark(
    { quizAveragePercent, draftingAveragePercent, examinationPercent },
    weights
  );

  const band = finalPercent != null ? await resolveGradeBand(finalPercent, new Date(), db) : null;

  return db.programmeResult.upsert({
    where: { enrolmentId },
    create: {
      enrolmentId,
      quizAveragePercent,
      draftingAveragePercent,
      examinationPercent,
      finalPercent,
      band,
      weightingSnapshot: weights,
      computedAt: new Date(),
      isProvisional,
    },
    update: {
      quizAveragePercent,
      draftingAveragePercent,
      examinationPercent,
      finalPercent,
      band,
      weightingSnapshot: weights,
      computedAt: new Date(),
      isProvisional,
    },
  });
}
