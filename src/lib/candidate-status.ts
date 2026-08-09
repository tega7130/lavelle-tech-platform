import "server-only";
import { prisma } from "@/lib/prisma";
import { revokeAllSessions } from "@/lib/candidate-session";
import { recordAuditEvent } from "@/lib/audit";
import { extendDeadlinesForSuspension } from "@/lib/deadline-generation";

/**
 * Suspend/reactivate has no Server Action anywhere in the codebase yet —
 * Slice 01 defined the CandidateAccountStatus/suspendedAt/suspendedReason/
 * reactivatedAt columns and the sign-in/session-check readers that treat
 * SUSPENDED as signed out, but nothing ever writes that transition. Built
 * here as in-scope for Slice 04 because extendDeadlinesForSuspension
 * (rule 8/9) has nothing to hook onto without it. Kept deliberately
 * minimal — no separate suspension-reason taxonomy, no scheduled/future
 * suspension, just the two transitions the schema already models.
 *
 * No "use server" / staff-auth import here (same discipline as
 * confirmPayment/applyOfflineRecording) — the caller's Server Action
 * wrapper does the permission check.
 */
export async function suspendCandidate(candidateId: string, staffId: string, reason: string, ipAddress?: string | null) {
  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: { accountStatus: "SUSPENDED", suspendedAt: new Date(), suspendedReason: reason, reactivatedAt: null },
  });
  await revokeAllSessions(candidateId);
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "candidate",
    subjectId: candidateId,
    action: "candidate.suspended",
    description: `Account suspended: ${reason}`,
    reason,
    ipAddress: ipAddress ?? null,
  });
  return candidate;
}

/**
 * Contact/profile detail edit — deliberately narrow (name, phone only).
 * Email is excluded: it's the sign-in identifier, and changing it safely
 * needs a re-verification flow this slice doesn't build.
 */
export async function updateCandidateDetails(
  candidateId: string,
  staffId: string,
  data: { firstName: string; lastName: string; phone: string | null },
  ipAddress?: string | null
) {
  const candidate = await prisma.candidate.update({ where: { id: candidateId }, data });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "candidate",
    subjectId: candidateId,
    action: "candidate.details_updated",
    description: "Contact details updated",
    ipAddress: ipAddress ?? null,
  });
  return candidate;
}

export async function reactivateCandidate(candidateId: string, staffId: string, ipAddress?: string | null) {
  const before = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  if (before.accountStatus !== "SUSPENDED" || !before.suspendedAt) {
    throw new Error("Candidate is not currently suspended");
  }
  const now = new Date();
  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: { accountStatus: "ACTIVE", reactivatedAt: now },
  });
  const extendedCount = await extendDeadlinesForSuspension({ candidateId, from: before.suspendedAt, to: now });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "candidate",
    subjectId: candidateId,
    action: "candidate.reactivated",
    description: `Account reactivated — ${extendedCount} deadline${extendedCount === 1 ? "" : "s"} extended for the suspension`,
    ipAddress: ipAddress ?? null,
  });
  return candidate;
}
