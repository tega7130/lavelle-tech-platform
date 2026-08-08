import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { resolveGradeBand } from "@/lib/grading";
import { recomputeProgrammeResult } from "@/lib/programme-result";
import { resolveMarkContext } from "@/lib/mark-context";
import type { GradeBand } from "@/generated/prisma/client";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as enrolment-transaction.ts / player-actions.ts. staffId is
// always passed in by the caller (a "use server" Action that already
// checked the permission), so this file stays importable from Vitest.

export class AlreadyClaimedError extends Error {
  constructor() {
    super("This item has already been claimed by another marker.");
    this.name = "AlreadyClaimedError";
  }
}

export class AlreadyReturnedError extends Error {
  constructor() {
    super("This mark has already been returned.");
    this.name = "AlreadyReturnedError";
  }
}

/** Row-locked (rule 3/6) — two faculty opening the queue at once must not both claim the same submission. */
export async function claimForMarking(markId: string, staffId: string) {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: string; state: string; markedByStaffId: string | null }[]>`
      SELECT id, state, "markedByStaffId" FROM "Mark" WHERE id = ${markId} FOR UPDATE
    `;
    if (!locked) throw new Error("Mark not found.");
    if (locked.state === "RETURNED") throw new AlreadyReturnedError();
    if (locked.state === "IN_REVIEW" && locked.markedByStaffId !== staffId) throw new AlreadyClaimedError();

    return tx.mark.update({ where: { id: markId }, data: { state: "IN_REVIEW", markedByStaffId: staffId } });
  });
}

export interface ReturnMarkInput {
  scorePercent: number;
  feedback: string;
  rubricScores?: Record<string, number> | null;
}

/**
 * Feedback is mandatory — enforced HERE, not only in the UI (rule 1). The
 * band is resolved once, against the scale in force right now (the
 * return moment IS the assessment date), and stored — never re-derived
 * later. recomputeProgrammeResult runs inside the same transaction so the
 * candidate's standing is never one write behind their own mark.
 */
export async function returnMark(markId: string, data: ReturnMarkInput, staffId: string, ipAddress: string | null) {
  const feedback = data.feedback.trim();
  if (!feedback) throw new Error("Feedback is required before a mark can be returned.");
  if (data.scorePercent < 0 || data.scorePercent > 100) throw new Error("Score must be between 0 and 100.");

  return prisma.$transaction(async (tx) => {
    const mark = await tx.mark.findUniqueOrThrow({ where: { id: markId } });
    if (mark.state === "RETURNED") throw new AlreadyReturnedError();

    const now = new Date();
    const band = await resolveGradeBand(data.scorePercent, now, tx);

    const updated = await tx.mark.update({
      where: { id: markId },
      data: {
        state: "RETURNED",
        scorePercent: data.scorePercent,
        band,
        feedback,
        rubricScores: data.rubricScores ?? undefined,
        markedByStaffId: mark.markedByStaffId ?? staffId,
        markedAt: now,
      },
    });

    if (mark.draftingSubmissionId) {
      await tx.draftingSubmission.update({ where: { id: mark.draftingSubmissionId }, data: { state: "RETURNED" } });
    }

    // A DRAFTING mark's enrolment has a rolling ProgrammeResult to keep
    // current. An EXAMINATION_WRITTEN mark does not — its Sitting's own
    // totalPercent is computed later, per window, by releaseResults
    // (Slice 06 rule: results release per window, not per return).
    if (mark.kind === "DRAFTING" && mark.enrolmentId) {
      await recomputeProgrammeResult(mark.enrolmentId, tx);
    }

    const { candidateId } = await resolveMarkContext(mark, tx);
    await tx.notification.create({
      data: {
        candidateId,
        category: "ASSESSMENT",
        title: `${data.scorePercent}% — ${bandLabel(band)}`,
        body: feedback,
      },
    });

    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "mark",
      subjectId: markId,
      action: "mark.returned",
      description: `Mark returned — ${data.scorePercent}% (${bandLabel(band)})`,
      ipAddress,
    });

    return updated;
  });
}

export interface RequestResubmissionInput {
  scorePercent?: number;
  feedback: string;
}

/**
 * The original attempt is retained (rule 4) — it's marked RETURNED (a
 * verdict was reached), never overwritten, and a fresh DraftingSubmission
 * attempt is opened for the candidate to redo. Gives the candidate seven
 * days: a DRAFTING_DUE deadline is created for the new attempt.
 */
export async function requestResubmission(markId: string, data: RequestResubmissionInput, staffId: string, ipAddress: string | null) {
  const feedback = data.feedback.trim();
  if (!feedback) throw new Error("Feedback is required before requesting a resubmission.");

  return prisma.$transaction(async (tx) => {
    const mark = await tx.mark.findUniqueOrThrow({
      where: { id: markId },
      include: { draftingSubmission: { include: { lecture: true, enrolment: true } } },
    });
    if (!mark.draftingSubmission) throw new Error("Only a drafting submission can be sent back for resubmission.");
    if (mark.state === "RETURNED") throw new AlreadyReturnedError();

    const now = new Date();
    const band = data.scorePercent != null ? await resolveGradeBand(data.scorePercent, now, tx) : null;

    await tx.mark.update({
      where: { id: markId },
      data: {
        state: "RESUBMISSION_REQUESTED",
        scorePercent: data.scorePercent ?? null,
        band,
        feedback,
        markedByStaffId: mark.markedByStaffId ?? staffId,
        markedAt: now,
      },
    });

    await tx.draftingSubmission.update({ where: { id: mark.draftingSubmission.id }, data: { state: "RETURNED" } });

    const dueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const enrolmentId = mark.draftingSubmission.enrolmentId;
    const [nextAttempt] = await Promise.all([
      tx.draftingSubmission.create({
        data: {
          enrolmentId,
          lectureId: mark.draftingSubmission.lectureId,
          attemptNumber: mark.draftingSubmission.attemptNumber + 1,
          state: "RESUBMITTED",
          body: "",
        },
      }),
      tx.deadline.create({
        data: {
          enrolmentId,
          kind: "DRAFTING_DUE",
          lectureId: mark.draftingSubmission.lectureId,
          title: `${mark.draftingSubmission.lecture.title} — resubmission due`,
          dueAt,
          originalDueAt: dueAt,
        },
      }),
      tx.notification.create({
        data: { candidateId: mark.draftingSubmission.enrolment.candidateId, category: "ASSESSMENT", title: "Resubmission requested", body: feedback },
      }),
    ]);

    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "mark",
      subjectId: markId,
      action: "mark.resubmission_requested",
      description: "Resubmission requested — new attempt opened, 7 days given",
      reason: feedback,
      ipAddress,
    });

    return nextAttempt;
  });
}

export interface ModerateMarkInput {
  scorePercent?: number;
  feedback?: string;
  reason: string;
}

/**
 * Second marker (rule: requires moderate_marks, checked by the caller).
 * Called on an already-RETURNED mark, changing its score is an AMENDMENT
 * (rule 6) — mandatory reason, audited, and the candidate is told. Called
 * before return, it's ordinary moderation of a first marker's work.
 */
export async function moderateMark(markId: string, data: ModerateMarkInput, staffId: string, ipAddress: string | null) {
  const reason = data.reason.trim();
  if (!reason) throw new Error("A reason is required to moderate or amend a mark.");

  return prisma.$transaction(async (tx) => {
    const mark = await tx.mark.findUniqueOrThrow({ where: { id: markId } });
    const now = new Date();
    const isAmendment = mark.state === "RETURNED" && data.scorePercent != null && data.scorePercent !== mark.scorePercent;
    const band = data.scorePercent != null ? await resolveGradeBand(data.scorePercent, now, tx) : mark.band;

    const updated = await tx.mark.update({
      where: { id: markId },
      data: {
        ...(data.scorePercent != null ? { scorePercent: data.scorePercent, band } : {}),
        ...(data.feedback != null ? { feedback: data.feedback.trim() } : {}),
        moderatedByStaffId: staffId,
        moderatedAt: now,
      },
    });

    if (mark.state === "RETURNED" && mark.kind === "DRAFTING" && mark.enrolmentId) {
      await recomputeProgrammeResult(mark.enrolmentId, tx);
    }

    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "mark",
      subjectId: markId,
      action: isAmendment ? "mark.amended" : "mark.moderated",
      description: isAmendment ? `Mark amended to ${data.scorePercent}%` : "Mark moderated by a second marker",
      reason,
      ipAddress,
    });

    if (isAmendment) {
      const { candidateId } = await resolveMarkContext(mark, tx);
      await tx.notification.create({
        data: {
          candidateId,
          category: "ASSESSMENT",
          title: "A returned mark was amended",
          body: `Your mark was amended to ${data.scorePercent}%. Reason: ${reason}`,
        },
      });
    }

    return updated;
  });
}

function bandLabel(band: GradeBand | null): string {
  if (!band) return "Ungraded";
  return { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" }[band];
}
