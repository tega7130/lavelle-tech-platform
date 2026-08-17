import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { computeShortfalls, type DrawableQuestion } from "@/lib/exam-draw";
import type { ExamQuestionType, ExamQuestionStatus, AttemptPolicy } from "@/generated/prisma/client";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as marking-actions.ts. staffId is always passed in by the
// caller (a "use server" Action that already checked the permission).

/** One actionable line per unmet publish requirement — never a generic "validation failed" (rule: spec §30/§56). */
export interface PublishIssue {
  message: string;
  action?: "review_bank" | "edit_draw" | "add_window" | "edit_content";
}

export class PublishBlockedError extends Error {
  constructor(public issues: PublishIssue[]) {
    super(`Cannot publish — ${issues.map((i) => i.message).join(" ")}`);
    this.name = "PublishBlockedError";
  }
}

/**
 * One Exam per Programme (Exam.programmeId is @unique) — this is the
 * missing "start a new examination" entry point; every other creation
 * path so far has only ever been prisma/seed.ts. Defaults mirror the
 * schema's own defaults so a freshly created exam is immediately usable
 * in the builder without a null-field crash.
 */
export async function createExam(programmeId: string, staffId: string, ipAddress: string | null) {
  const existing = await prisma.exam.findUnique({ where: { programmeId } });
  if (existing) throw new Error("This programme already has an examination.");

  const exam = await prisma.exam.create({
    data: {
      programmeId,
      status: "DRAFT",
      durationMinutes: 180,
      passMarkPercent: 60,
      attemptPolicy: "ONE_RESIT_ON_REFERRAL",
      feeMinor: 0,
    },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: exam.id,
    action: "exam.created",
    description: "Examination created",
    ipAddress,
  });

  return exam;
}

export interface CreateStandaloneExamInput {
  title: string;
  code: string;
  tier: "FOUNDATION" | "SPECIALIST"; // ADVANCED_PRACTITIONER deliberately excluded — its prerequisite (exam-eligibility.ts) requires a completed Specialist enrolment in the same category, a ladder concept a standalone exam never participates in.
  categoryId?: string | null;
  newCategoryName?: string | null;
}

/**
 * An exam that isn't "for" any real Lavelle programme — candidates can
 * register, pay, sit and earn a certificate for it without a course
 * existing on the platform. The schema still requires Exam.programmeId
 * (a real FK, not nullable — rule: no breaking change to the working
 * exam pipeline), so this creates a minimal, invisible Programme "shell"
 * underneath it: DRAFT status + isExamOnlyShell true keep it out of the
 * admin Programmes list (programme-reads.ts) and the candidate
 * enrolment catalogue (catalogue-reads.ts filters status=ACTIVE only).
 * No ProgrammeListing row is ever created, so it's invisible to the
 * public marketing site too. The certificate PDF's EXAMINATION_ONLY
 * branch (certificate-pdf.ts) already reads programmeTitle without the
 * word "programme" — since that title IS the exam's own name here, the
 * certificate correctly reads as an exam credential, not a programme one.
 */
export async function createStandaloneExam(input: CreateStandaloneExamInput, staffId: string, ipAddress: string | null) {
  const title = input.title.trim();
  if (!title) throw new Error("Examination title is required.");
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Examination code is required.");
  if (input.tier !== "FOUNDATION" && input.tier !== "SPECIALIST") {
    throw new Error("A standalone examination must be Foundation or Specialist level.");
  }

  const exam = await prisma.$transaction(async (tx) => {
    let categoryId = input.categoryId ?? null;
    if (!categoryId) {
      const name = (input.newCategoryName ?? "").trim();
      if (!name) throw new Error("Choose a topic, or create a new one.");
      const existing = await tx.programmeCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
      categoryId = existing ? existing.id : (await tx.programmeCategory.create({ data: { name, slug: slugify(name) } })).id;
    }

    const codeTaken = await tx.programme.findUnique({ where: { code } });
    if (codeTaken) throw new Error("That examination code is already in use.");

    const shell = await tx.programme.create({
      data: {
        code,
        title,
        categoryId,
        tier: input.tier,
        status: "DRAFT",
        isExamOnlyShell: true,
        summary: title,
        weeks: 0,
        weeklyHoursLabel: "—",
        credits: 0,
        feeMinor: 0,
        createdByStaffId: staffId,
      },
    });

    return tx.exam.create({
      data: {
        programmeId: shell.id,
        status: "DRAFT",
        durationMinutes: 180,
        passMarkPercent: 60,
        attemptPolicy: "ONE_RESIT_ON_REFERRAL",
        feeMinor: 0,
      },
    });
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: exam.id,
    action: "exam.created",
    description: `Standalone examination created: ${title}`,
    ipAddress,
  });

  return exam;
}

export interface ExamModuleInput {
  title: string;
  examQuestionDraw: number;
}

/**
 * A standalone exam's shell Programme starts with zero Modules (rule:
 * the shell has no candidate-facing content, so nothing else ever
 * creates one) — without this, a standalone exam has no module to hang
 * questions off, and createExamQuestion has nowhere to point. A linked
 * exam's modules already exist from the programme's own content editor
 * (weeks/lectures), so this is refused there — creating a lecture-less
 * "week" from inside the exam builder would surface as a broken empty
 * week to real enrolled candidates on that real programme.
 */
export async function addExamModule(examId: string, input: ExamModuleInput, staffId: string, ipAddress: string | null) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { programme: true } });
  if (!exam.programme.isExamOnlyShell) {
    throw new Error("This examination is linked to a programme — add or edit its modules from the programme's own content editor.");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Module title is required.");
  const draw = Math.trunc(input.examQuestionDraw);
  if (!Number.isFinite(draw) || draw < 0) throw new Error("Questions drawn must be zero or a positive whole number.");

  const count = await prisma.module.count({ where: { programmeId: exam.programmeId } });
  const created = await prisma.module.create({
    data: { programmeId: exam.programmeId, weekNumber: count + 1, title, examQuestionDraw: draw, orderIndex: count },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: examId,
    action: "exam.module_added",
    description: `Added module "${created.title}" to the question bank`,
    ipAddress,
  });

  return created;
}

export async function updateExamModule(moduleId: string, input: ExamModuleInput, staffId: string, ipAddress: string | null) {
  const existing = await prisma.module.findUniqueOrThrow({ where: { id: moduleId }, include: { programme: { include: { exam: true } } } });
  if (!existing.programme.isExamOnlyShell) {
    throw new Error("This examination is linked to a programme — add or edit its modules from the programme's own content editor.");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Module title is required.");
  const draw = Math.trunc(input.examQuestionDraw);
  if (!Number.isFinite(draw) || draw < 0) throw new Error("Questions drawn must be zero or a positive whole number.");

  const updated = await prisma.module.update({ where: { id: moduleId }, data: { title, examQuestionDraw: draw } });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: existing.programme.exam?.id ?? existing.programmeId,
    action: "exam.module_updated",
    description: `Updated module "${updated.title}"`,
    ipAddress,
  });

  return updated;
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
  if (!Number.isInteger(data.marks) || data.marks <= 0) throw new Error("Marks must be a positive whole number.");
  if (data.type === "OBJECTIVE") {
    const options = data.options ?? [];
    if (options.length < 2) throw new Error("Add at least two answer options.");
    if (options.some((o) => !o.text.trim())) throw new Error("Answer options cannot be empty.");
    if (options.filter((o) => o.isCorrect).length !== 1) throw new Error("Select exactly one correct answer.");
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
  if (data.marks !== undefined && (!Number.isInteger(data.marks) || data.marks <= 0)) {
    throw new Error("Marks must be a positive whole number.");
  }
  if (data.options) {
    if (data.options.length < 2) throw new Error("Add at least two answer options.");
    if (data.options.some((o) => !o.text.trim())) throw new Error("Answer options cannot be empty.");
    if (data.options.filter((o) => o.isCorrect).length !== 1) throw new Error("Select exactly one correct answer.");
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

export interface ExamWindowInput {
  opensAt: Date;
  closesAt: Date;
  registrationDeadline: Date;
  capacity?: number | null; // null = uncapped
}

function validateWindowInput(input: ExamWindowInput) {
  if (input.closesAt.getTime() < input.opensAt.getTime()) {
    throw new Error("The examination window cannot close before it opens.");
  }
  if (input.registrationDeadline.getTime() >= input.opensAt.getTime()) {
    throw new Error("Registration must close before the examination window opens.");
  }
  if (input.capacity != null && input.capacity < 1) {
    throw new Error("Capacity must be at least 1, or left uncapped.");
  }
}

export async function createExamWindow(examId: string, input: ExamWindowInput, staffId: string, ipAddress: string | null) {
  validateWindowInput(input);
  const window = await prisma.examWindow.create({
    data: { examId, opensAt: input.opensAt, closesAt: input.closesAt, registrationDeadline: input.registrationDeadline, capacity: input.capacity ?? null },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam_window",
    subjectId: window.id,
    action: "exam_window.created",
    description: `Sitting added: opens ${input.opensAt.toISOString().slice(0, 10)}`,
    ipAddress,
  });

  return window;
}

export async function updateExamWindow(examId: string, windowId: string, input: ExamWindowInput, staffId: string, ipAddress: string | null) {
  validateWindowInput(input);
  const window = await prisma.examWindow.findUniqueOrThrow({ where: { id: windowId } });
  if (window.examId !== examId) throw new Error("That sitting does not belong to this examination.");

  const updated = await prisma.examWindow.update({
    where: { id: windowId },
    data: { opensAt: input.opensAt, closesAt: input.closesAt, registrationDeadline: input.registrationDeadline, capacity: input.capacity ?? null },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam_window",
    subjectId: windowId,
    action: "exam_window.edited",
    description: `Sitting edited: opens ${input.opensAt.toISOString().slice(0, 10)}`,
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

export interface ExamRequirementInput {
  text: string;
  isMandatory: boolean;
}

/** Replace-all, same pattern as ExamQuestionOption on updateExamQuestion — an empty array means "open to all," no separate flag needed. */
export async function setExamRequirements(examId: string, requirements: ExamRequirementInput[], staffId: string, ipAddress: string | null) {
  const cleaned = requirements.filter((r) => r.text.trim());

  await prisma.$transaction([
    prisma.examRequirement.deleteMany({ where: { examId } }),
    prisma.examRequirement.createMany({
      data: cleaned.map((r, i) => ({ examId, text: r.text.trim(), isMandatory: r.isMandatory, orderIndex: i })),
    }),
  ]);

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: examId,
    action: "exam.requirements_updated",
    description: cleaned.length === 0 ? "Eligibility set to open to all candidates" : `Eligibility requirements updated (${cleaned.length})`,
    ipAddress,
  });

  return prisma.examRequirement.findMany({ where: { examId }, orderBy: { orderIndex: "asc" } });
}

export interface ExamContentInput {
  description: string;
  instructions: string;
  examFormat: string;
  examinationAreas: string[];
  onPassing: string[];
}

export async function setExamContent(examId: string, input: ExamContentInput, staffId: string, ipAddress: string | null) {
  const updated = await prisma.exam.update({
    where: { id: examId },
    data: {
      description: input.description.trim() || null,
      instructions: input.instructions.trim() || null,
      examFormat: input.examFormat.trim() || null,
      examinationAreas: input.examinationAreas.filter((a) => a.trim()),
      onPassing: input.onPassing.filter((a) => a.trim()),
    },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: examId,
    action: "exam.content_updated",
    description: "Candidate-facing examination content updated",
    ipAddress,
  });

  return updated;
}

/** No new registrations or attempts; historical data untouched. Only from PUBLISHED — a DRAFT exam is closed by simply never publishing it. */
export async function closeExam(examId: string, staffId: string, ipAddress: string | null) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
  if (exam.status !== "PUBLISHED") throw new Error("Only a published examination can be closed.");

  const updated = await prisma.exam.update({
    where: { id: examId },
    data: { status: "CLOSED", closedAt: new Date(), closedByStaffId: staffId },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: examId,
    action: "exam.closed",
    description: "Examination closed to new registrations and attempts",
    ipAddress,
  });

  return updated;
}

/** Read-only historical record. From CLOSED (the normal path) or PUBLISHED (an exam retired without ever being formally closed). */
export async function archiveExam(examId: string, staffId: string, ipAddress: string | null) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
  if (exam.status !== "CLOSED" && exam.status !== "PUBLISHED") {
    throw new Error("Only a closed or published examination can be archived.");
  }

  const updated = await prisma.exam.update({
    where: { id: examId },
    data: { status: "ARCHIVED", archivedAt: new Date(), archivedByStaffId: staffId },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam",
    subjectId: examId,
    action: "exam.archived",
    description: "Examination archived",
    ipAddress,
  });

  return updated;
}

/**
 * Full checklist (rule: spec §29/§30/§56), not fail-fast on the first
 * problem — collects every unmet requirement so the admin fixes them
 * once, not one dialog at a time.
 */
export async function publishExam(examId: string, staffId: string, ipAddress: string | null) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId } });
  const modules = await prisma.module.findMany({ where: { programmeId: exam.programmeId } });
  const questions = await prisma.examQuestion.findMany({ where: { examId } });
  const windowCount = await prisma.examWindow.count({ where: { examId } });

  const issues: PublishIssue[] = [];

  const shortfalls = computeShortfalls(
    modules.map((m) => ({ moduleId: m.id, moduleTitle: m.title, draw: m.examQuestionDraw, questions: questions as unknown as DrawableQuestion[] }))
  );
  for (const s of shortfalls) {
    issues.push({
      message: `${s.moduleTitle} requires ${s.draw} approved objective question${s.draw === 1 ? "" : "s"}, but only ${s.approvedObjectiveCount} ${s.approvedObjectiveCount === 1 ? "is" : "are"} approved. Approve another question or lower the draw.`,
      action: "review_bank",
    });
  }

  if (windowCount === 0) {
    issues.push({ message: "No examination sitting has been configured. Add at least one sitting before publishing.", action: "add_window" });
  }

  if (!exam.description?.trim()) {
    issues.push({ message: "Candidate-facing description is missing — this is what candidates read before registering.", action: "edit_content" });
  }
  if (!exam.examFormat?.trim()) {
    issues.push({ message: "Examination format is not set (e.g. \"Objective + written\").", action: "edit_content" });
  }
  const areas = Array.isArray(exam.examinationAreas) ? (exam.examinationAreas as unknown[]) : [];
  if (areas.length === 0) {
    issues.push({ message: "\"What is examined\" has no entries — candidates need at least one.", action: "edit_content" });
  }
  const onPassing = Array.isArray(exam.onPassing) ? (exam.onPassing as unknown[]) : [];
  if (onPassing.length === 0) {
    issues.push({ message: "\"On passing\" has no entries — candidates need at least one.", action: "edit_content" });
  }

  if (issues.length > 0) throw new PublishBlockedError(issues);

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
