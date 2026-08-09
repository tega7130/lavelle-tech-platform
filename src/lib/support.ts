import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

/**
 * Reply to a support request. Sets firstRespondedAt on the request's
 * first-ever staff reply only (subsequent replies don't move it) — the
 * admin-overview "unanswered over 24h" KPI reads that column rather than
 * re-walking the thread every time.
 */
export async function respondToRequest(requestId: string, staffId: string, body: string) {
  const request = await prisma.supportRequest.findUniqueOrThrow({ where: { id: requestId } });
  await prisma.$transaction(async (tx) => {
    await tx.supportMessage.create({ data: { requestId, authorStaffId: staffId, body } });
    await tx.supportRequest.update({
      where: { id: requestId },
      data: {
        status: request.status === "OPEN" ? "IN_PROGRESS" : request.status,
        assignedStaffId: request.assignedStaffId ?? staffId,
        firstRespondedAt: request.firstRespondedAt ?? new Date(),
      },
    });
  });
}

export async function resolveRequest(requestId: string, staffId: string) {
  await prisma.supportRequest.update({ where: { id: requestId }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "support_request",
    subjectId: requestId,
    action: "support_request.resolved",
    description: "Support request marked resolved",
  });
}

/** Internal-only, never candidate-visible, never edited or deleted (a correction is a new note). */
export async function addCandidateNote(candidateId: string, staffId: string, body: string) {
  return prisma.candidateNote.create({ data: { candidateId, authorStaffId: staffId, body } });
}
