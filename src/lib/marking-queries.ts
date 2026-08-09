import { prisma } from "@/lib/prisma";
import { MarkState, MarkableKind } from "@/generated/prisma/client";
import { resolveMarkContext } from "@/lib/mark-context";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as player-actions.ts / offline-recording.ts. The permission
// check and staffId resolution are the caller's (marking-reads.ts')
// responsibility, so this file stays importable from Vitest.

// Every state except RETURNED means "not yet handed back" — the awaiting
// tab groups AWAITING/IN_REVIEW/RESUBMISSION_REQUESTED together so a
// claimed-but-not-yet-returned item doesn't vanish from the queue.
const AWAITING_STATES: MarkState[] = [MarkState.AWAITING, MarkState.IN_REVIEW, MarkState.RESUBMISSION_REQUESTED];

export function blindReference(markId: string) {
  return `Reference ${markId.slice(0, 8).toUpperCase()}`;
}

export interface ListMarkingQueueParams {
  tab: "awaiting" | "returned";
  kind?: MarkableKind;
  // Not yet filtered — resolving a mark's programme now requires walking
  // two different paths (enrolment, or examWrittenAnswer -> sitting ->
  // registration -> exam), which the small queue sizes here don't yet
  // need to pay for. Left in the params shape for a future pass.
  programmeId?: string;
  assignedToMe?: boolean;
}

/**
 * Blind marking (rule 7, Slice 05) is enforced HERE, in the query —
 * candidate name/number are only ever fetched for programmes with
 * blindMarking false, via a second, separate query keyed on the
 * non-blind subset. A blind row never has the candidate's identity in
 * memory to begin with, not just hidden from the return value. A mark's
 * candidate/programme is resolved via resolveMarkContext, which knows
 * both a DRAFTING mark's enrolment path and an EXAMINATION_WRITTEN
 * mark's exam-registration path (rule 14, Slice 06 — an exam-only
 * registration has no enrolment at all).
 */
export async function listMarkingQueueQuery(params: ListMarkingQueueParams, staffId: string) {
  const baseWhere = {
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.assignedToMe ? { markedByStaffId: staffId } : {}),
  };

  // programmeId can't be pushed into the Prisma `where` cheaply — a
  // DRAFTING mark's programme lives behind its enrolment, an
  // EXAMINATION_WRITTEN mark's behind exam registration — so both tabs
  // are fetched and resolveMarkContext filters/counts in memory. Fine
  // at these queue sizes (see the function comment above).
  const allMarks = await prisma.mark.findMany({
    where: { ...baseWhere, state: { in: [...AWAITING_STATES, MarkState.RETURNED] } },
    select: {
      id: true,
      kind: true,
      state: true,
      isLate: true,
      scorePercent: true,
      band: true,
      createdAt: true,
      markedByStaffId: true,
      enrolmentId: true,
      examWrittenAnswerId: true,
      draftingSubmission: {
        select: { attemptNumber: true, submittedAt: true, lecture: { select: { title: true, module: { select: { title: true, weekNumber: true } } } } },
      },
      examWrittenAnswer: {
        select: { answeredAt: true, question: { select: { prompt: true, module: { select: { title: true, weekNumber: true } } } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const allContexts = await Promise.all(allMarks.map((m) => resolveMarkContext(m, prisma)));

  const scopedIndices = allMarks.map((_, i) => i).filter((i) => !params.programmeId || allContexts[i]!.programmeId === params.programmeId);
  const awaitingCount = scopedIndices.filter((i) => AWAITING_STATES.includes(allMarks[i]!.state)).length;
  const returnedCount = scopedIndices.filter((i) => allMarks[i]!.state === MarkState.RETURNED).length;

  const tabIndices = scopedIndices.filter((i) =>
    params.tab === "awaiting" ? AWAITING_STATES.includes(allMarks[i]!.state) : allMarks[i]!.state === MarkState.RETURNED
  );
  const marks = tabIndices.map((i) => allMarks[i]!);
  const contexts = tabIndices.map((i) => allContexts[i]!);

  const nonBlindCandidateIds = [...new Set(contexts.filter((c) => !c.blindMarking).map((c) => c.candidateId))];
  const candidates = nonBlindCandidateIds.length
    ? await prisma.candidate.findMany({ where: { id: { in: nonBlindCandidateIds } }, select: { id: true, firstName: true, lastName: true, candidateNumber: true } })
    : [];
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  const items = marks.map((m, i) => {
    const context = contexts[i]!;
    const blind = context.blindMarking;
    const candidate = blind ? null : (candidateById.get(context.candidateId) ?? null);
    return {
      id: m.id,
      kind: m.kind,
      state: m.state,
      isLate: m.isLate,
      scorePercent: m.scorePercent,
      band: m.band,
      createdAt: m.createdAt,
      claimedByMe: m.markedByStaffId === staffId,
      isClaimed: m.markedByStaffId != null,
      isBlind: blind,
      candidateLabel: blind ? blindReference(m.id) : candidate ? `${candidate.firstName} ${candidate.lastName}` : "Unknown candidate",
      programmeTitle: context.programmeTitle,
      source: m.draftingSubmission
        ? `${m.draftingSubmission.lecture.module.title} · ${m.draftingSubmission.lecture.title}`
        : m.examWrittenAnswer
          ? `${m.examWrittenAnswer.question.module.title} · Examination written answer`
          : "Examination — written answer",
      meta: m.draftingSubmission?.submittedAt
        ? `Submitted ${m.draftingSubmission.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
        : m.examWrittenAnswer?.answeredAt
          ? `Submitted ${m.examWrittenAnswer.answeredAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
          : "",
    };
  });

  return { items, counts: { awaiting: awaitingCount, returned: returnedCount } };
}

/**
 * The full marking view for one item — prompt, submission, rubric, prior
 * attempts, and (unless the programme is blind) the candidate's
 * identity. Same enforcement discipline as listMarkingQueueQuery: the
 * identity fetch is a SEPARATE query, skipped entirely when blind.
 */
export async function openMarkableQuery(markId: string) {
  const mark = await prisma.mark.findUniqueOrThrow({
    where: { id: markId },
    select: {
      id: true,
      kind: true,
      state: true,
      scorePercent: true,
      band: true,
      feedback: true,
      rubricScores: true,
      isLate: true,
      markedByStaffId: true,
      markedAt: true,
      moderatedByStaffId: true,
      moderatedAt: true,
      enrolmentId: true,
      examWrittenAnswerId: true,
      draftingSubmission: {
        select: {
          id: true,
          body: true,
          wordCount: true,
          attemptNumber: true,
          submittedAt: true,
          lecture: {
            select: { id: true, title: true, draftingPrompt: true, draftingWordLimit: true, module: { select: { title: true, weekNumber: true } } },
          },
        },
      },
      examWrittenAnswer: {
        select: {
          id: true,
          writtenAnswer: true,
          answeredAt: true,
          question: { select: { id: true, prompt: true, guidance: true, wordLimit: true, marks: true, module: { select: { title: true, weekNumber: true } } } },
        },
      },
    },
  });

  const context = await resolveMarkContext(mark, prisma);
  const blind = context.blindMarking;
  const candidate = blind
    ? null
    : await prisma.candidate.findUnique({ where: { id: context.candidateId }, select: { firstName: true, lastName: true, candidateNumber: true } });

  const [priorAttempts, rubric] = await Promise.all([
    mark.draftingSubmission
      ? prisma.mark.findMany({
          where: { enrolmentId: mark.enrolmentId, kind: MarkableKind.DRAFTING, draftingSubmission: { lectureId: mark.draftingSubmission.lecture.id }, NOT: { id: mark.id } },
          select: {
            id: true,
            state: true,
            scorePercent: true,
            band: true,
            feedback: true,
            draftingSubmission: { select: { attemptNumber: true, submittedAt: true, body: true } },
          },
          orderBy: { draftingSubmission: { attemptNumber: "asc" } },
        })
      : Promise.resolve([]),
    mark.draftingSubmission
      ? prisma.markRubric.findFirst({ where: { lectureId: mark.draftingSubmission.lecture.id }, include: { criteria: { orderBy: { orderIndex: "asc" } } } })
      : Promise.resolve(null),
  ]);

  return {
    id: mark.id,
    kind: mark.kind,
    state: mark.state,
    scorePercent: mark.scorePercent,
    band: mark.band,
    feedback: mark.feedback,
    rubricScores: mark.rubricScores as Record<string, number> | null,
    isLate: mark.isLate,
    markedByStaffId: mark.markedByStaffId,
    markedAt: mark.markedAt,
    moderatedByStaffId: mark.moderatedByStaffId,
    moderatedAt: mark.moderatedAt,
    programmeTitle: context.programmeTitle,
    isBlind: blind,
    candidateLabel: blind ? blindReference(mark.id) : candidate ? `${candidate.firstName} ${candidate.lastName}` : "Unknown candidate",
    candidateNumber: blind ? null : (candidate?.candidateNumber ?? null),
    submission: mark.draftingSubmission
      ? {
          kind: "drafting" as const,
          body: mark.draftingSubmission.body,
          wordCount: mark.draftingSubmission.wordCount,
          attemptNumber: mark.draftingSubmission.attemptNumber,
          submittedAt: mark.draftingSubmission.submittedAt,
          prompt: mark.draftingSubmission.lecture.draftingPrompt,
          wordLimit: mark.draftingSubmission.lecture.draftingWordLimit,
          lectureTitle: mark.draftingSubmission.lecture.title,
          moduleTitle: mark.draftingSubmission.lecture.module.title,
        }
      : mark.examWrittenAnswer
        ? {
            kind: "exam" as const,
            body: mark.examWrittenAnswer.writtenAnswer ?? "",
            wordCount: (mark.examWrittenAnswer.writtenAnswer ?? "").trim().split(/\s+/).filter(Boolean).length,
            attemptNumber: 1,
            submittedAt: mark.examWrittenAnswer.answeredAt,
            prompt: mark.examWrittenAnswer.question.prompt,
            wordLimit: mark.examWrittenAnswer.question.wordLimit,
            lectureTitle: null,
            moduleTitle: mark.examWrittenAnswer.question.module.title,
            guidance: mark.examWrittenAnswer.question.guidance,
            marks: mark.examWrittenAnswer.question.marks,
          }
        : null,
    priorAttempts,
    rubric,
  };
}
