import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { requireExamAccess } from "@/lib/exam-staff";
import { Permission } from "@/generated/prisma/client";
import { computeShortfalls, computeActualDrawTotal, type DrawableQuestion } from "@/lib/exam-draw";

/**
 * Grouped by module, with approved counts against each module's draw
 * (rule 1) — the shortfall figures and "drawn per sitting" total both
 * come from src/lib/exam-draw.ts so the builder and startSitting can
 * never disagree about what can actually be assembled.
 */
export async function listExamBank(examId: string) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);

  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { programme: true } });
  const modules = await prisma.module.findMany({ where: { programmeId: exam.programmeId }, orderBy: { weekNumber: "asc" } });
  const questions = await prisma.examQuestion.findMany({
    where: { examId },
    include: { options: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const drawInputs = modules.map((m) => ({
    moduleId: m.id,
    moduleTitle: m.title,
    draw: m.examQuestionDraw,
    questions: questions as unknown as DrawableQuestion[],
  }));
  const shortfalls = computeShortfalls(drawInputs);
  const drawnTotal = computeActualDrawTotal(drawInputs);
  const shortfallByModule = new Map(shortfalls.map((s) => [s.moduleId, s]));

  const bank = modules.map((m) => {
    const moduleQuestions = questions.filter((q) => q.moduleId === m.id);
    return {
      id: m.id,
      title: m.title,
      weekNumber: m.weekNumber,
      draw: m.examQuestionDraw,
      shortfall: shortfallByModule.get(m.id) ?? null,
      questions: moduleQuestions.map((q) => ({
        id: q.id,
        type: q.type,
        status: q.status,
        prompt: q.prompt,
        marks: q.marks,
        examinerNote: q.examinerNote,
        guidance: q.guidance,
        wordLimit: q.wordLimit,
        retiredAt: q.retiredAt,
        retiredReason: q.retiredReason,
        options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      })),
      approvedCount: moduleQuestions.filter((q) => q.status === "APPROVED").length,
      totalCount: moduleQuestions.length,
    };
  });

  return {
    exam: {
      id: exam.id,
      status: exam.status,
      programmeId: exam.programmeId,
      programmeTitle: exam.programme.title,
      publishedAt: exam.publishedAt,
      durationMinutes: exam.durationMinutes,
      passMarkPercent: exam.passMarkPercent,
      attemptPolicy: exam.attemptPolicy,
      feeMinor: exam.feeMinor,
      enforceFullScreen: exam.enforceFullScreen,
      warnOnTabSwitch: exam.warnOnTabSwitch,
      shuffleQuestions: exam.shuffleQuestions,
      shuffleOptions: exam.shuffleOptions,
      allowReviewBeforeSubmit: exam.allowReviewBeforeSubmit,
    },
    modules: bank,
    shortfalls,
    drawnTotal,
    approvedCount: questions.filter((q) => q.status === "APPROVED").length,
    totalCount: questions.length,
  };
}

/** The programme picker at the top of the builder — one Exam per programme. */
export async function listExamsForBuilder() {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const exams = await prisma.exam.findMany({
    include: { programme: { select: { title: true, code: true } } },
    orderBy: { createdAt: "asc" },
  });
  return exams.map((e) => ({ id: e.id, status: e.status, programmeTitle: e.programme.title, programmeCode: e.programme.code }));
}

/** Windows with their sitting counts by state — the release-results trigger point (rule 12: per window, not per candidate). */
export async function listExamWindows(examId: string) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const windows = await prisma.examWindow.findMany({
    where: { examId },
    include: { registrations: { include: { sitting: true } } },
    orderBy: { opensAt: "desc" },
  });

  return windows.map((w) => {
    const sittings = w.registrations.map((r) => r.sitting).filter((s): s is NonNullable<typeof s> => !!s);
    return {
      id: w.id,
      opensAt: w.opensAt,
      closesAt: w.closesAt,
      capacity: w.capacity,
      registered: w.registrations.length,
      submitted: sittings.filter((s) => s.state === "SUBMITTED").length,
      released: sittings.filter((s) => s.state === "RELEASED").length,
      inProgress: sittings.filter((s) => s.state === "IN_PROGRESS").length,
    };
  });
}

/** Minimal exam header for the candidates page — gated via requireExamAccess (not MANAGE_EXAMS), so an exam-assigned staff member without it can still open the page at all. */
export async function getExamSummaryForAccess(examId: string) {
  const staff = await requireExamAccess(examId);
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { programme: { select: { title: true, code: true } } } });
  return {
    id: exam.id,
    status: exam.status,
    programmeTitle: exam.programme.title,
    programmeCode: exam.programme.code,
    canManageStaff: staff.permissions.includes(Permission.MANAGE_EXAMS),
  };
}

/**
 * Every candidate who has registered for this exam (any window, live
 * registrations only — cancelledAt null), with what they applied under
 * (window, attempt, pathway, payment) and their sitting's current state
 * and result if one exists. Gated via requireExamAccess so an exam-
 * assigned staff member, not just a blanket MANAGE_EXAMS holder, can
 * reach it.
 */
export async function listExamCandidates(examId: string) {
  await requireExamAccess(examId);

  const registrations = await prisma.examRegistration.findMany({
    where: { examId, cancelledAt: null },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, candidateNumber: true, applicantNumber: true } },
      window: { select: { id: true, opensAt: true, closesAt: true } },
      payment: { select: { status: true, amountMinor: true } },
      sitting: {
        select: {
          id: true,
          state: true,
          objectivePercent: true,
          writtenPercent: true,
          totalPercent: true,
          outcome: true,
          band: true,
          conductReview: true,
          submittedAt: true,
          releasedAt: true,
        },
      },
    },
    orderBy: { registeredAt: "desc" },
  });

  return registrations.map((r) => ({
    registrationId: r.id,
    candidateId: r.candidate.id,
    candidateName: `${r.candidate.firstName} ${r.candidate.lastName}`,
    candidateNumber: r.candidate.candidateNumber ?? r.candidate.applicantNumber,
    windowId: r.window.id,
    windowOpensAt: r.window.opensAt,
    windowClosesAt: r.window.closesAt,
    pathway: r.enrolmentId ? ("enrolled" as const) : ("exam_only" as const),
    attemptNumber: r.attemptNumber,
    paymentStatus: r.payment?.status ?? null,
    registeredAt: r.registeredAt,
    sitting: r.sitting,
  }));
}

/**
 * One candidate's full sitting — every answer with the question it was
 * for (and, for objective ones, whether it was correct), plus that
 * answer's Mark if one exists. examId is required and checked against
 * the sitting's own registration so a staff member scoped to exam A
 * can't read a sitting that belongs to exam B by guessing its id.
 */
export async function getExamSittingDetail(sittingId: string, examId: string) {
  await requireExamAccess(examId);

  const sitting = await prisma.sitting.findUniqueOrThrow({
    where: { id: sittingId },
    include: {
      registration: {
        include: {
          candidate: { select: { firstName: true, lastName: true, candidateNumber: true, applicantNumber: true } },
        },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              prompt: true,
              type: true,
              marks: true,
              guidance: true,
              wordLimit: true,
              module: { select: { title: true, weekNumber: true } },
              options: { select: { id: true, text: true, isCorrect: true } },
            },
          },
          selectedOption: { select: { id: true, text: true, isCorrect: true } },
          mark: {
            select: {
              id: true,
              state: true,
              scorePercent: true,
              band: true,
              feedback: true,
              markedAt: true,
              markedByStaff: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (sitting.registration.examId !== examId) {
    throw new Error("This sitting does not belong to this examination.");
  }

  const candidate = sitting.registration.candidate;
  return {
    id: sitting.id,
    state: sitting.state,
    startedAt: sitting.startedAt,
    submittedAt: sitting.submittedAt,
    objectivePercent: sitting.objectivePercent,
    writtenPercent: sitting.writtenPercent,
    totalPercent: sitting.totalPercent,
    outcome: sitting.outcome,
    band: sitting.band,
    conductReview: sitting.conductReview,
    candidateName: `${candidate.firstName} ${candidate.lastName}`,
    candidateNumber: candidate.candidateNumber ?? candidate.applicantNumber,
    answers: sitting.answers
      .sort((a, b) => a.question.module.weekNumber - b.question.module.weekNumber)
      .map((a) => ({
        id: a.id,
        moduleTitle: a.question.module.title,
        weekNumber: a.question.module.weekNumber,
        type: a.question.type,
        prompt: a.question.prompt,
        marks: a.question.marks,
        guidance: a.question.guidance,
        wordLimit: a.question.wordLimit,
        selectedOptionId: a.selectedOptionId,
        selectedOptionText: a.selectedOption?.text ?? null,
        selectedOptionCorrect: a.selectedOption?.isCorrect ?? null,
        correctOptionText: a.question.options.find((o) => o.isCorrect)?.text ?? null,
        writtenAnswer: a.writtenAnswer,
        flagged: a.flagged,
        mark: a.mark,
      })),
  };
}
