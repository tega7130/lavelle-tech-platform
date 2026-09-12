"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Permission, ContentStatus } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { recordAuditEvent } from "@/lib/audit";
import { QuizValidationError } from "@/lib/programme-errors";
import { validateOneCorrectOptionPerQuestion } from "@/lib/programme-publish";
import {
  moduleInputSchema,
  lectureInputSchema,
  slideInputSchema,
  narrationConfigSchema,
  upsertQuizSchema,
  type NarrationConfigInput,
} from "@/lib/validation/programme";

/**
 * upsertQuizSchema.parse() throws a raw ZodError whose .message is a JSON
 * array of issues — fine for a safeParse+fieldErrors form, useless as a
 * banner string (the editor just renders e.message verbatim). Turns the
 * first issue's path back into the same "Question N, option M" language
 * the editor's UI uses, so a candidate-invisible authoring mistake reads
 * like one.
 */
function describeQuizIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Check the quiz for missing fields.";
  const [root, qIndex, field, oIndex] = issue.path;
  if (root === "questions" && typeof qIndex === "number") {
    const qLabel = `Question ${qIndex + 1}`;
    if (field === "options" && typeof oIndex === "number") {
      return `${qLabel}, option ${oIndex + 1}: ${issue.message}`;
    }
    if (field === "options") return `${qLabel}: ${issue.message}`;
    if (field === "prompt") return `${qLabel}: prompt is required.`;
    return `${qLabel}: ${issue.message}`;
  }
  return issue.message;
}

async function revalidateContent(programmeId: string) {
  revalidatePath(`/programmes/${programmeId}/content`);
}

// ── Modules ────────────────────────────────────────────────────────────

export async function addModule(programmeId: string, input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const data = moduleInputSchema.parse(input);

  const count = await prisma.module.count({ where: { programmeId } });
  const created = await prisma.module.create({
    data: { programmeId, ...data, orderIndex: count },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: programmeId,
    action: "programme.module_added",
    description: `Added module "${created.title}" (week ${created.weekNumber})`,
  });
  await revalidateContent(programmeId);
  return created;
}

export async function updateModule(moduleId: string, input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const data = moduleInputSchema.partial().parse(input);

  const updated = await prisma.module.update({ where: { id: moduleId }, data });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: updated.programmeId,
    action: "programme.module_updated",
    description: `Updated module "${updated.title}"`,
  });
  await revalidateContent(updated.programmeId);
  return updated;
}

/**
 * DRAFT/PUBLISHED/ARCHIVED, the umbrella control above a lecture's own
 * status — a DRAFT/ARCHIVED module drops its entire subtree out of the
 * candidate-facing tree (loadModuleTree in player-reads.ts only loads
 * PUBLISHED modules) regardless of what any individual lecture inside it
 * is set to. Never a hard delete, same rule as setLectureStatus below.
 */
export async function setModuleStatus(moduleId: string, status: ContentStatus) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

  const updated = await prisma.module.update({ where: { id: moduleId }, data: { status } });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: updated.programmeId,
    action: "programme.module_status_changed",
    description: `Changed module "${updated.title}" status to ${status}`,
  });
  await revalidateContent(updated.programmeId);
  return updated;
}

/** Writes orderIndex for the whole set in one transaction (rule 9) — never insertion order or createdAt for sequence. */
export async function reorderModules(programmeId: string, orderedModuleIds: string[]) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

  await prisma.$transaction(
    orderedModuleIds.map((id, index) =>
      prisma.module.update({ where: { id, programmeId }, data: { orderIndex: index } })
    )
  );

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: programmeId,
    action: "programme.modules_reordered",
    description: `Reordered ${orderedModuleIds.length} modules`,
  });
  await revalidateContent(programmeId);
}

// ── Lectures ───────────────────────────────────────────────────────────

export async function addLecture(moduleId: string, input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const data = lectureInputSchema.parse(input);
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });

  const count = await prisma.lecture.count({ where: { moduleId } });
  const created = await prisma.lecture.create({
    data: { moduleId, orderIndex: count, ...data },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.lecture_added",
    description: `Added lecture "${created.title}" to "${mod.title}"`,
  });
  await revalidateContent(mod.programmeId);
  return created;
}

export async function updateLecture(lectureId: string, input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const data = lectureInputSchema.partial().parse(input);

  const updated = await prisma.lecture.update({ where: { id: lectureId }, data });
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: updated.moduleId } });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.lecture_updated",
    description: `Updated lecture "${updated.title}"`,
  });
  await revalidateContent(mod.programmeId);
  return updated;
}

export async function reorderLectures(moduleId: string, orderedLectureIds: string[]) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });

  await prisma.$transaction(
    orderedLectureIds.map((id, index) =>
      prisma.lecture.update({ where: { id, moduleId }, data: { orderIndex: index } })
    )
  );

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.lectures_reordered",
    description: `Reordered ${orderedLectureIds.length} lectures in "${mod.title}"`,
  });
  await revalidateContent(mod.programmeId);
}

/**
 * DRAFT/PUBLISHED/ARCHIVED — never a hard delete. "Removing" a lecture is
 * setting it ARCHIVED: it drops out of the candidate-facing module tree
 * (loadModuleTree in player-reads.ts only loads PUBLISHED lectures) but
 * the row, its slides, and any candidate's LectureProgress against it stay
 * in place — a candidate who already completed it simply stops seeing it
 * going forward, and a certificate already issued reads from Marks/
 * Certificate records, never from the live Lecture table, so it can't be
 * affected by this either way.
 */
export async function setLectureStatus(lectureId: string, status: ContentStatus) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

  const updated = await prisma.lecture.update({ where: { id: lectureId }, data: { status } });
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: updated.moduleId } });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.lecture_status_changed",
    description: `Changed lecture "${updated.title}" status to ${status}`,
  });
  await revalidateContent(mod.programmeId);
  return updated;
}

/**
 * Validates the narration mode combination (rule 5) and — the one place
 * this matters — forces narrationAutoAdvance to false whenever the mode
 * is FULL_LECTURE, since the field is meaningless there and the rule
 * requires it stored false, not just ignored.
 */
export async function setNarration(lectureId: string, config: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const parsed: NarrationConfigInput = narrationConfigSchema.parse(config);

  const data = {
    narrationMode: parsed.narrationMode,
    narrationAutoAdvance: parsed.narrationMode === "FULL_LECTURE" ? false : parsed.narrationAutoAdvance,
    narrationRequireFull: parsed.narrationRequireFull,
    fullNarrationAssetId: parsed.narrationMode === "FULL_LECTURE" ? (parsed.fullNarrationAssetId ?? null) : null,
  };

  const updated = await prisma.lecture.update({ where: { id: lectureId }, data });
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: updated.moduleId } });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.narration_set",
    description: `Set narration on "${updated.title}" to ${parsed.narrationMode}`,
  });
  await revalidateContent(mod.programmeId);
  return updated;
}

// ── Slides ─────────────────────────────────────────────────────────────

export async function addSlide(lectureId: string, input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const data = slideInputSchema.parse(input);

  const count = await prisma.slide.count({ where: { lectureId } });
  const created = await prisma.slide.create({ data: { lectureId, orderIndex: count, ...data } });

  const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } });
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: lecture.moduleId } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.slide_added",
    description: `Added a slide to "${lecture.title}"`,
  });
  await revalidateContent(mod.programmeId);
  return created;
}

export async function updateSlide(
  slideId: string,
  input: unknown & { narrationAssetId?: string | null; imageAssetId?: string | null }
) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const parsedInput = input as Record<string, unknown>;
  const data = slideInputSchema.partial().parse(input);
  const extra: { narrationAssetId?: string | null; imageAssetId?: string | null } = {};
  if ("narrationAssetId" in parsedInput) extra.narrationAssetId = parsedInput.narrationAssetId as string | null;
  if ("imageAssetId" in parsedInput) extra.imageAssetId = parsedInput.imageAssetId as string | null;

  const updated = await prisma.slide.update({ where: { id: slideId }, data: { ...data, ...extra } });
  const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: updated.lectureId } });
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: lecture.moduleId } });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.slide_updated",
    description: `Updated a slide in "${lecture.title}"`,
  });
  await revalidateContent(mod.programmeId);
  return updated;
}

export async function reorderSlides(lectureId: string, orderedSlideIds: string[]) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } });
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: lecture.moduleId } });

  await prisma.$transaction(
    orderedSlideIds.map((id, index) =>
      prisma.slide.update({ where: { id, lectureId }, data: { orderIndex: index } })
    )
  );

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.slides_reordered",
    description: `Reordered ${orderedSlideIds.length} slides in "${lecture.title}"`,
  });
  await revalidateContent(mod.programmeId);
}

export async function deleteSlide(slideId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const slide = await prisma.slide.findUniqueOrThrow({ where: { id: slideId } });
  const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: slide.lectureId } });
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: lecture.moduleId } });

  await prisma.$transaction(async (tx) => {
    await tx.slide.delete({ where: { id: slideId } });
    // Close the orderIndex gap so sequence stays dense — never rely on
    // whatever's left over from deletion.
    const remaining = await tx.slide.findMany({
      where: { lectureId: slide.lectureId },
      orderBy: { orderIndex: "asc" },
    });
    await Promise.all(remaining.map((s, i) => tx.slide.update({ where: { id: s.id }, data: { orderIndex: i } })));
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.slide_deleted",
    description: `Deleted a slide from "${lecture.title}"`,
  });
  await revalidateContent(mod.programmeId);
}

// ── Module quiz ────────────────────────────────────────────────────────

/** Replace-all semantics — validates exactly one correct option per question (rule 8) before writing anything. */
export async function upsertQuiz(moduleId: string, input: unknown) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const parsed = upsertQuizSchema.safeParse(input);
  if (!parsed.success) throw new QuizValidationError(describeQuizIssue(parsed.error));
  const data = parsed.data;

  const violation = validateOneCorrectOptionPerQuestion(data.questions);
  if (violation) throw new QuizValidationError(violation);

  const mod = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });

  const quiz = await prisma.$transaction(async (tx) => {
    const quizRow = await tx.quiz.upsert({
      where: { moduleId },
      update: { passMarkPercent: data.passMarkPercent },
      create: { moduleId, passMarkPercent: data.passMarkPercent },
    });

    await tx.quizQuestion.deleteMany({ where: { quizId: quizRow.id } });
    for (const [qi, q] of data.questions.entries()) {
      await tx.quizQuestion.create({
        data: {
          quizId: quizRow.id,
          orderIndex: qi,
          prompt: q.prompt,
          marks: q.marks,
          explanation: q.explanation,
          options: {
            create: q.options.map((o, oi) => ({ orderIndex: oi, text: o.text, isCorrect: o.isCorrect })),
          },
        },
      });
    }
    return quizRow;
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.quiz_set",
    description: `Set the quiz for "${mod.title}" (${data.questions.length} questions)`,
  });
  await revalidateContent(mod.programmeId);
  return quiz;
}

/** Same DRAFT/PUBLISHED/ARCHIVED soft-delete model as setLectureStatus — see that function's comment. */
export async function setQuizStatus(quizId: string, status: ContentStatus) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

  const updated = await prisma.quiz.update({ where: { id: quizId }, data: { status } });
  const mod = await prisma.module.findUniqueOrThrow({ where: { id: updated.moduleId } });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: mod.programmeId,
    action: "programme.quiz_status_changed",
    description: `Changed the quiz status for "${mod.title}" to ${status}`,
  });
  await revalidateContent(mod.programmeId);
  return updated;
}
