import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission, MarkState, MarkableKind } from "@/generated/prisma/client";
import { listMarkingQueueQuery, openMarkableQuery, type ListMarkingQueueParams } from "@/lib/marking-queries";

export type { ListMarkingQueueParams };

export async function listMarkingQueue(params: ListMarkingQueueParams) {
  const staff = await requireStaffPermission(Permission.GRADE_ASSESSMENTS);
  return listMarkingQueueQuery(params, staff.id);
}

export async function openMarkable(markId: string) {
  await requireStaffPermission(Permission.GRADE_ASSESSMENTS);
  return openMarkableQuery(markId);
}

/**
 * Grouped by programme, with the weighted average, band, per-assessment
 * rows and the grading scale in force. Every query here is filtered to
 * RETURNED marks / submitted quiz attempts only — an in-progress mark is
 * never visible through this or any other candidate-facing endpoint
 * (rule 10/12).
 */
export async function getCandidateResults(candidateId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { candidateId, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { programme: { include: { assessmentWeightings: true } }, programmeResult: true },
    orderBy: { enrolledAt: "desc" },
  });

  const scale = await prisma.gradeBandDefinition.findMany({ where: { effectiveTo: null }, orderBy: { minPercent: "desc" } });

  const results = await Promise.all(
    enrolments.map(async (e) => {
      const [quizAttempts, draftingMarks] = await Promise.all([
        prisma.quizAttempt.findMany({
          where: { enrolmentId: e.id, submittedAt: { not: null } },
          include: { quiz: { include: { module: true } } },
          orderBy: { submittedAt: "asc" },
        }),
        prisma.mark.findMany({
          where: { enrolmentId: e.id, kind: MarkableKind.DRAFTING, state: MarkState.RETURNED },
          include: { draftingSubmission: { include: { lecture: { include: { module: true } } } } },
          orderBy: { markedAt: "asc" },
        }),
      ]);

      const weights = Object.fromEntries(e.programme.assessmentWeightings.map((w) => [w.kind, w.weightPercent])) as Record<string, number>;

      return {
        programme: { id: e.programme.id, title: e.programme.title, code: e.programme.code, tier: e.programme.tier },
        enrolmentId: e.id,
        weights,
        result: e.programmeResult,
        quizRows: quizAttempts.map((a) => ({
          title: `${a.quiz.module.title} quiz`,
          module: a.quiz.module.title,
          date: a.submittedAt,
          scorePercent: a.scorePercent,
          weight: weights.QUIZ ?? null,
        })),
        draftingRows: draftingMarks.map((m) => ({
          title: m.draftingSubmission!.lecture.title,
          module: m.draftingSubmission!.lecture.module.title,
          date: m.markedAt,
          scorePercent: m.scorePercent,
          band: m.band,
          weight: weights.DRAFTING ?? null,
        })),
      };
    })
  );

  return { results, scale };
}

/**
 * The admin candidate-record Assessments & grades tab — quizzes,
 * examinations and drafting exercises as three separate tables (per
 * Lavelle Candidate Record.dc.html), gated on VIEW_GRADES. Unlike
 * getCandidateResults, this shows PENDING drafting work too (a "Grade
 * now" affordance for a mark not yet RETURNED) — rule 10/12's "invisible
 * until RETURNED" is about candidate-facing endpoints, not this one.
 */
export async function listCandidateMarks(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_GRADES);

  const enrolments = await prisma.enrolment.findMany({ where: { candidateId }, select: { id: true } });
  const enrolmentIds = enrolments.map((e) => e.id);
  if (enrolmentIds.length === 0) return { quizzes: [], drafting: [] };

  const [quizAttempts, draftingMarks] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { enrolmentId: { in: enrolmentIds }, submittedAt: { not: null } },
      include: { quiz: { include: { module: true } } },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.mark.findMany({
      where: { enrolmentId: { in: enrolmentIds }, kind: MarkableKind.DRAFTING },
      include: { draftingSubmission: { include: { lecture: true } }, markedByStaff: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // A quiz can be retaken — attempts count per quiz, shown against its
  // most recent submitted score.
  const attemptCountByQuiz = new Map<string, number>();
  for (const a of quizAttempts) attemptCountByQuiz.set(a.quizId, (attemptCountByQuiz.get(a.quizId) ?? 0) + 1);
  const seenQuiz = new Set<string>();

  return {
    quizzes: quizAttempts
      .filter((a) => {
        if (seenQuiz.has(a.quizId)) return false;
        seenQuiz.add(a.quizId);
        return true;
      })
      .map((a) => ({
        module: a.quiz.module.title,
        scorePercent: a.scorePercent,
        date: a.submittedAt,
        attempts: attemptCountByQuiz.get(a.quizId) ?? 1,
      })),
    drafting: draftingMarks.map((m) => ({
      id: m.id,
      lecture: m.draftingSubmission!.lecture.title,
      submittedAt: m.draftingSubmission!.submittedAt,
      state: m.state,
      scorePercent: m.scorePercent,
      band: m.band,
      markedByName: m.markedByStaff?.name ?? null,
      markedAt: m.markedAt,
    })),
  };
}
