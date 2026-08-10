import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as exam-builder-actions.ts / marking-actions.ts. staffId is
// always passed in by the caller (a "use server" Action that already
// checked manage_exams), so this file stays importable from plain Vitest.

/** README B3 rule 1: both Clear and Refer stay disabled — client AND server — until a finding is written. */
export class FindingRequiredError extends Error {
  constructor() {
    super("Write an invigilator finding before clearing or referring this sitting.");
    this.name = "FindingRequiredError";
  }
}

/** Clearing releases the result on the next releaseResults pass — this action only records the review, it never releases anything itself. */
export async function clearSitting(sittingId: string, finding: string, staffId: string, ipAddress: string | null) {
  const trimmed = finding.trim();
  if (!trimmed) throw new FindingRequiredError();

  const now = new Date();
  const updated = await prisma.sitting.update({
    where: { id: sittingId },
    data: { conductReview: "CLEARED", invigilatorFinding: trimmed, reviewedByStaffId: staffId, reviewedAt: now },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "sitting",
    subjectId: sittingId,
    action: "sitting.cleared",
    description: "Cleared the sitting after conduct review",
    reason: trimmed,
    ipAddress,
  });

  return updated;
}

/** README B3 rule 3: a REFERRED sitting is excluded from releaseResults until the examinations panel resolves it — a later process this slice does not build. */
export async function referSitting(sittingId: string, finding: string, staffId: string, ipAddress: string | null) {
  const trimmed = finding.trim();
  if (!trimmed) throw new FindingRequiredError();

  const now = new Date();
  const updated = await prisma.sitting.update({
    where: { id: sittingId },
    data: { conductReview: "REFERRED", invigilatorFinding: trimmed, reviewedByStaffId: staffId, reviewedAt: now, referredAt: now },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "sitting",
    subjectId: sittingId,
    action: "sitting.referred",
    description: "Referred the sitting to the examinations panel",
    reason: trimmed,
    ipAddress,
  });

  return updated;
}
