import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { computeShortfalls, type DrawableQuestion } from "@/lib/exam-draw";
import type { ExamQuestionType, ExamQuestionStatus, AttemptPolicy } from "@/generated/prisma/client";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as marking-actions.ts. staffId is always passed in by the
// caller (a "use server" Action that already checked the permission).

export class PublishBlockedError extends Error {
  constructor(public shortModules: { moduleTitle: string; shortBy: number }[]) {
    super(`Cannot publish — short by objective questions in: ${shortModules.map((m) => `${m.moduleTitle} (${m.shortBy})`).join(", ")}`);
    this.name = "PublishBlockedError";
  }
}

export interface CreateExamQuestionInput {
  moduleId: string;
  type: ExamQuestionType;
  status?: ExamQuestionStatus;
  prompt: string;
  marks: number;
  examinerNote?: string | null;
  guidance?: string | null;
  wordLimit?: number | null;
  options?: { text: string; isCorrect: boolean }[]; // objective only
}

export async function createExamQuestion(examId: string, data: CreateExamQuestionInput) {
  if (data.type === "OBJECTIVE") {
    const options = data.options ?? [];
    if (options.length < 2) throw new Error("An objective question needs at least two options.");
    if (options.filter((o) => o.isCorrect).length !== 1) throw new Error("Exactly one option must be marked correct.");
  }
  return prisma.examQuestion.create({
    data: {
      examId,
      moduleId: data.moduleId,
      type: data.type,
      status: data.status ?? "DRAFT",
      prompt: data.prompt,
      marks: data.marks,
      examinerNote: data.examinerNote ?? null,
      guidance: data.guidance ?? null,
      wordLimit: data.type === "WRITTEN" ? (data.wordLimit ?? null) : null,
      options:
        data.type === "OBJECTIVE" && data.options
          ? { create: data.options.map((o, i) => ({ orderIndex: i, text: o.text, isCorrect: o.isCorrect })) }
          : undefined,
    },
    include: { options: true },
  });
}

export interface UpdateExamQuestionInput {
  status?: ExamQuestionStatus;
  prompt?: string;
  marks?: number;
  examinerNote?: string | null;
  guidance?: string | null;
  wordLimit?: number | null;
  options?: { id?: string; text: string; isCorrect: boolean }[];
}

/**
 * Applies to future sittings only (rule 4/7) — nothing here touches any
 * Sitting row. A candidate mid-paper (or one who already sat) reads from
 * their own frozen paperSnapshot, never live from ExamQuestion, so this
 * update simply can't reach them.
 */
export async function updateExamQuestion(id: string, data: UpdateExamQuestionInput) {
  const question = await prisma.examQuestion.findUniqueOrThrow({ where: { id } });
  if (data.options && data.options.filter((o) => o.isCorrect).length !== 1) {
    throw new Error("Exactly one option must be marked correct.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.examQuestion.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
        ...(data.marks !== undefined ? { marks: data.marks } : {}),
        ...(data.examinerNote !== undefined ? { examinerNote: data.examinerNote } : {}),
        ...(data.guidance !== undefined ? { guidance: data.guidance } : {}),
        ...(data.wordLimit !== undefined ? { wordLimit: data.wordLimit } : {}),
      },
    });
    if (data.options) {
      await tx.examQuestionOption.deleteMany({ where: { questionId: id } });
      await tx.examQuestionOption.createMany({
        data: data.options.map((o, i) => ({ questionId: id, orderIndex: i, text: o.text, isCorrect: o.isCorrect })),
      });
    }
    return { ...updated, moduleId: question.moduleId };
  });
}

/** Mandatory reason (rule 3/8) — the question stays on the record and is restorable; marks already awarded against it are untouched (they live on Mark/Sitting rows, not here). */
export async function retireExamQuestion(id: string, reason: string, staffId: string, ipAddress: string | null) {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required to retire a question.");

  const question = await prisma.examQuestion.findUniqueOrThrow({ where: { id } });
  const now = new Date();

  const updated = await prisma.examQuestion.update({
    where: { id },
    data: { status: "RETIRED", retiredAt: now, retiredReason: trimmed, retiredByStaffId: staffId },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam_question",
    subjectId: id,
    action: "exam_question.retired",
    description: `Retired exam question: ${question.prompt.slice(0, 80)}`,
    reason: trimmed,
    ipAddress,
  });

  return updated;
}

export async function restoreExamQuestion(id: string, staffId: string, ipAddress: string | null) {
  const updated = await prisma.examQuestion.update({
    where: { id },
    data: { status: "APPROVED", retiredAt: null, retiredReason: null, retiredByStaffId: null },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam_question",
    subjectId: id,
    action: "exam_question.restored",
    description: "Restored exam question to the pool",
    ipAddress,
  });

  return updated;
}

export interface ExamRulesInput {
  durationMinutes: number;
  passMarkPercent: number;
  attemptPolicy: AttemptPolicy;
  feeMinor: number;
  enforceFullScreen: boolean;
  warnOnTabSwitch: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowReviewBeforeSubmit: boolean;
  // Slice 11 Part A: ExamWindow.capacity already exists and is already
  // enforced by registerForExam — it just had no input. Capacity is a
  // per-window field, but the rules panel edits it for the one window the
  // builder is currently configuring (capacityWindowId, chosen by the
  // caller — see exam-builder.tsx's "current window" pick), so this one
  // action still carries the whole rules panel in a single call rather
  // than adding a second action (README A: "No new action").
  capacityWindowId?: string | null;
  capacity?: number | null; // null = uncapped
}

export async function setExamRules(examId: string, rules: ExamRulesInput) {
  if (rules.durationMinutes < 60 || rules.durationMinutes > 360 || rules.durationMinutes % 30 !== 0) {
    throw new Error("Duration must be between 60 and 360 minutes, in 30-minute steps.");
  }
  if (rules.passMarkPercent < 1 || rules.passMarkPercent > 100) throw new Error("Pass mark must be between 1 and 100.");
  if (rules.feeMinor < 0) throw new Error("Fee cannot be negative.");
  if (rules.capacity != null && rules.capacity < 1) throw new Error("Capacity must be at least 1, or left uncapped.");

  const { capacityWindowId, capacity, ...examFields } = rules;
  const updated = await prisma.exam.update({ where: { id: examId }, data: examFields });

  if (capacityWindowId) {
    const window = await prisma.examWindow.findUniqueOrThrow({ where: { id: capacityWindowId } });
    if (window.examId !== examId) throw new Error("That window does not belong to this examination.");
    await prisma.examWindow.update({ where: { id: capacityWindowId }, data: { capacity: capacity ?? null } });
  }

  return updated;
}

/** Blocked while any module has fewer approved objective questions than its draw (rule 1) — names the offending modules. */
export async function publishExam(examId: string, staffId: string, ipAddress: string | null) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
  const modules = await prisma.module.findMany({ where: { programmeId: exam.programmeId } });
  const questions = await prisma.examQuestion.findMany({ where: { examId } });

  const shortfalls = computeShortfalls(
    modules.map((m) => ({ moduleId: m.id, moduleTitle: m.title, draw: m.examQuestionDraw, questions: questions as unknown as DrawableQuestion[] }))
  );
  if (shortfalls.length > 0) {
    throw new PublishBlockedError(shortfalls.map((s) => ({ moduleTitle: s.moduleTitle, shortBy: s.shortBy })));
  }

  const now = new Date();
  const updated = await prisma.exam.update({
    where: { id: examId },
    data: { status: "PUBLISHED", publishedAt: now, publishedByStaffId: staffId },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: examId,
    action: "exam.published",
    description: "Exam published",
    ipAddress,
  });

  return updated;
}
