import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { generateDeadlinesForEnrolment } from "@/lib/deadline-generation";

export class EnrolmentNotFoundError extends Error {
  constructor() {
    super("Enrolment not found.");
    this.name = "EnrolmentNotFoundError";
  }
}

/**
 * Wipes a candidate's progress in ONE programme back to the start —
 * every LectureProgress/VideoWatchProgress/DraftingSubmission/
 * QuizAttempt/Deadline/ProgrammeResult row tied to this enrolment, then
 * regenerates a fresh
 * deadline schedule (generateDeadlinesForEnrolment only ever creates
 * rows, so the stale ones must go first). Scoped to a single enrolment,
 * not the candidate — progress in any other programme the same
 * candidate is enrolled in is untouched. Deleting DraftingSubmission and
 * QuizAttempt rows cascades their Mark/QuizAnswer children automatically
 * (schema onDelete: Cascade). The Enrolment row itself and its Payments
 * are never touched — a reset undoes coursework, not the fact of having
 * paid and enrolled.
 */
export async function resetEnrolmentProgress(enrolmentId: string, reason: string, staffId: string) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to reset a candidate's progress.");

  const enrolment = await prisma.enrolment.findUnique({
    where: { id: enrolmentId },
    include: {
      programme: { select: { code: true, title: true } },
      candidate: { select: { firstName: true, lastName: true, applicantNumber: true } },
    },
  });
  if (!enrolment) throw new EnrolmentNotFoundError();

  await prisma.$transaction(async (tx) => {
    await tx.lectureProgress.deleteMany({ where: { enrolmentId } });
    await tx.videoWatchProgress.deleteMany({ where: { enrolmentId } });
    await tx.draftingSubmission.deleteMany({ where: { enrolmentId } });
    await tx.quizAttempt.deleteMany({ where: { enrolmentId } });
    await tx.deadline.deleteMany({ where: { enrolmentId } });
    await tx.programmeResult.deleteMany({ where: { enrolmentId } });

    await tx.enrolment.update({
      where: { id: enrolmentId },
      data: {
        completedAt: null,
        ...(enrolment.status === "COMPLETED" ? { status: "ACTIVE" } : {}),
      },
    });

    await generateDeadlinesForEnrolment(enrolmentId, tx);

    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "enrolment",
      subjectId: enrolmentId,
      action: "enrolment.progress_reset",
      description: `Reset ${enrolment.candidate.firstName} ${enrolment.candidate.lastName}'s (${enrolment.candidate.applicantNumber}) progress in ${enrolment.programme.code} — ${enrolment.programme.title}`,
      reason: trimmedReason,
    });
  });
}
