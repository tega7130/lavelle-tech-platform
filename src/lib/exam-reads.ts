import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { computeShortfalls, computeActualDrawTotal, type DrawableQuestion } from "@/lib/exam-draw";

/**
 * Grouped by module, with approved counts against each module's draw
 * (rule 1) — the shortfall figures and "drawn per sitting" total both
 * come from src/lib/exam-draw.ts so the builder and startSitting can
 * never disagree about what can actually be assembled.
 */
export async function listExamBank(examId: string) {
  await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

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
  await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const exams = await prisma.exam.findMany({
    include: { programme: { select: { title: true, code: true } } },
    orderBy: { createdAt: "asc" },
  });
  return exams.map((e) => ({ id: e.id, status: e.status, programmeTitle: e.programme.title, programmeCode: e.programme.code }));
}

/** Windows with their sitting counts by state — the release-results trigger point (rule 12: per window, not per candidate). */
export async function listExamWindows(examId: string) {
  await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
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
      registered: w.registrations.length,
      submitted: sittings.filter((s) => s.state === "SUBMITTED").length,
      released: sittings.filter((s) => s.state === "RELEASED").length,
      inProgress: sittings.filter((s) => s.state === "IN_PROGRESS").length,
    };
  });
}
