import { prisma } from "@/lib/prisma";
import { MarkState, MarkableKind } from "@/generated/prisma/client";

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
  programmeId?: string;
  assignedToMe?: boolean;
}

/**
 * Blind marking (rule 7) is enforced HERE, in the query — candidate
 * name/number are only ever fetched for programmes with blindMarking
 * false, via a second, separate query keyed on the non-blind subset. A
 * blind row never has the candidate's identity in memory to begin with,
 * not just hidden from the return value.
 */
export async function listMarkingQueueQuery(params: ListMarkingQueueParams, staffId: string) {
  const baseWhere = {
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.programmeId ? { enrolment: { programmeId: params.programmeId } } : {}),
    ...(params.assignedToMe ? { markedByStaffId: staffId } : {}),
  };

  const [marks, awaitingCount, returnedCount] = await Promise.all([
    prisma.mark.findMany({
      where: { ...baseWhere, state: params.tab === "awaiting" ? { in: AWAITING_STATES } : MarkState.RETURNED },
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
        enrolment: { select: { candidateId: true, programme: { select: { title: true, code: true, blindMarking: true } } } },
        draftingSubmission: {
          select: { attemptNumber: true, submittedAt: true, lecture: { select: { title: true, module: { select: { title: true, weekNumber: true } } } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mark.count({ where: { ...baseWhere, state: { in: AWAITING_STATES } } }),
    prisma.mark.count({ where: { ...baseWhere, state: MarkState.RETURNED } }),
  ]);

  const nonBlindCandidateIds = [...new Set(marks.filter((m) => !m.enrolment.programme.blindMarking).map((m) => m.enrolment.candidateId))];
  const candidates = nonBlindCandidateIds.length
    ? await prisma.candidate.findMany({ where: { id: { in: nonBlindCandidateIds } }, select: { id: true, firstName: true, lastName: true, candidateNumber: true } })
    : [];
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  const items = marks.map((m) => {
    const blind = m.enrolment.programme.blindMarking;
    const candidate = blind ? null : (candidateById.get(m.enrolment.candidateId) ?? null);
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
      programmeTitle: m.enrolment.programme.title,
      source: m.draftingSubmission
        ? `${m.draftingSubmission.lecture.module.title} · ${m.draftingSubmission.lecture.title}`
        : "Examination — written answer",
      meta: m.draftingSubmission?.submittedAt
        ? `Submitted ${m.draftingSubmission.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
        : "",
    };
  });

  return { items, counts: { awaiting: awaitingCount, returned: returnedCount } };
}

/**
 * The full marking view for one item — prompt, submission, rubric, prior
 * attempts, and (unless the programme is blind) the candidate's identity.
 * Same enforcement discipline as listMarkingQueueQuery: the identity
 * fetch is a SEPARATE query, skipped entirely when blind.
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
      enrolment: { select: { candidateId: true, programme: { select: { id: true, title: true, blindMarking: true } } } },
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
    },
  });

  const blind = mark.enrolment.programme.blindMarking;
  const candidate = blind
    ? null
    : await prisma.candidate.findUnique({ where: { id: mark.enrolment.candidateId }, select: { firstName: true, lastName: true, candidateNumber: true } });

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
    programmeTitle: mark.enrolment.programme.title,
    isBlind: blind,
    candidateLabel: blind ? blindReference(mark.id) : candidate ? `${candidate.firstName} ${candidate.lastName}` : "Unknown candidate",
    candidateNumber: blind ? null : (candidate?.candidateNumber ?? null),
    submission: mark.draftingSubmission
      ? {
          body: mark.draftingSubmission.body,
          wordCount: mark.draftingSubmission.wordCount,
          attemptNumber: mark.draftingSubmission.attemptNumber,
          submittedAt: mark.draftingSubmission.submittedAt,
          prompt: mark.draftingSubmission.lecture.draftingPrompt,
          wordLimit: mark.draftingSubmission.lecture.draftingWordLimit,
          lectureTitle: mark.draftingSubmission.lecture.title,
          moduleTitle: mark.draftingSubmission.lecture.module.title,
        }
      : null,
    priorAttempts,
    rubric,
  };
}
