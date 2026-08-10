import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

// No "server-only" / staff-auth / candidate-session import here,
// deliberately — same discipline as support.ts / exam-sitting-actions.ts.
// candidateId/staffId are always passed in by the caller, so this file
// stays importable from plain Vitest.

export class NotCompletedError extends Error {
  constructor() {
    super("Only candidates who have completed this programme may submit a review.");
    this.name = "NotCompletedError";
  }
}

export interface SubmitReviewInput {
  candidateId: string;
  enrolmentId: string;
  rating: number;
  quote: string;
}

/**
 * README D3 rule 3: gated against a COMPLETED enrolment, not a role or a
 * flag — re-checked here even though the caller may already know the
 * enrolment exists, because "completed" can only be trusted at the
 * moment of submission. authorName/authorTitle are populated from the
 * candidate at submission time (a real review, unlike the marketing
 * testimonials Slice 09 seeded) and never change afterwards — the
 * candidate's own words, attributed to who they were when they wrote it.
 */
export async function submitReview(input: SubmitReviewInput) {
  const enrolment = await prisma.enrolment.findUniqueOrThrow({
    where: { id: input.enrolmentId },
    include: { candidate: { include: { profile: true } }, programme: { select: { id: true } } },
  });
  if (enrolment.candidateId !== input.candidateId) throw new Error("This enrolment does not belong to you.");
  if (enrolment.status !== "COMPLETED") throw new NotCompletedError();
  if (input.rating < 1 || input.rating > 5) throw new Error("Rating must be between 1 and 5.");
  const quote = input.quote.trim();
  if (!quote) throw new Error("Write a few words before submitting.");

  const profile = enrolment.candidate.profile;
  const authorTitle = profile?.roleTitle
    ? profile.organisation
      ? `${profile.roleTitle}, ${profile.organisation}`
      : profile.roleTitle
    : "Lavelle alumnus";

  return prisma.review.create({
    data: {
      candidateId: input.candidateId,
      enrolmentId: input.enrolmentId,
      programmeId: enrolment.programme.id,
      authorName: `${enrolment.candidate.firstName} ${enrolment.candidate.lastName}`,
      authorTitle,
      quote,
      rating: input.rating,
      state: "PENDING",
    },
  });
}

/** README D3 rule 1: nothing appears on the public site until approved. */
export async function approveReview(reviewId: string, staffId: string, ipAddress: string | null) {
  const now = new Date();
  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { state: "PUBLISHED", moderatedByStaffId: staffId, moderatedAt: now },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "review",
    subjectId: reviewId,
    action: "review.approved",
    description: "Approved and published a candidate review",
    ipAddress,
  });
  return updated;
}

/** README D3 rule 4: the reason is internal only — never surfaced to the candidate; that conversation belongs in support. */
export async function declineReview(reviewId: string, reason: string, staffId: string, ipAddress: string | null) {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required to decline a review.");
  const now = new Date();
  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { state: "DECLINED", declineReason: trimmed, moderatedByStaffId: staffId, moderatedAt: now },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "review",
    subjectId: reviewId,
    action: "review.declined",
    description: "Declined a candidate review",
    reason: trimmed,
    ipAddress,
  });
  return updated;
}

/** Pulls a published review back off the public site — a visibility change, not an edit of its words (rule 2). */
export async function unpublishReview(reviewId: string, staffId: string, ipAddress: string | null) {
  const now = new Date();
  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { state: "PENDING", moderatedByStaffId: staffId, moderatedAt: now },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "review",
    subjectId: reviewId,
    action: "review.unpublished",
    description: "Unpublished a review from the public site",
    ipAddress,
  });
  return updated;
}
