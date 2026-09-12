import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { RequestStatus, type RequestPriority, type RequestCategory } from "@/generated/prisma/client";

/**
 * Reply to a support request. Sets firstRespondedAt on the request's
 * first-ever staff reply only (subsequent replies don't move it) — the
 * admin-overview "unanswered over 24h" KPI reads that column rather than
 * re-walking the thread every time. A reply to an unassigned request
 * self-assigns the replier as a courtesy (pre-dates Slice 10's formal
 * Assign dialog) — assignedByStaffId stays null there, which correctly
 * means only that assignee (not a second "assigner") may resolve it.
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

export interface AssignRequestInput {
  requestId: string;
  staffId: string;
  priority: RequestPriority;
  note?: string;
}

/** Moves the request to IN_PROGRESS, records who assigned it and when, and notifies the assignee (README B2/B5). */
export async function assignRequest(input: AssignRequestInput, actingStaffId: string) {
  const trimmedNote = input.note?.trim() || null;

  await prisma.$transaction(async (tx) => {
    const request = await tx.supportRequest.update({
      where: { id: input.requestId },
      data: {
        assignedStaffId: input.staffId,
        assignedByStaffId: actingStaffId,
        assignedAt: new Date(),
        assignmentNote: trimmedNote,
        priority: input.priority,
        status: RequestStatus.IN_PROGRESS,
      },
    });
    await recordAuditEvent(tx, {
      actorStaffId: actingStaffId,
      subjectType: "support_request",
      subjectId: input.requestId,
      action: "support_request.assigned",
      description: `Assigned "${request.subject}" at ${input.priority.toLowerCase()} priority`,
    });
    await tx.notification.create({
      data: {
        staffId: input.staffId,
        category: "SUPPORT",
        title: "A support request was assigned to you",
        body: trimmedNote ? `"${request.subject}" (${input.priority.toLowerCase()} priority). ${trimmedNote}` : `"${request.subject}" (${input.priority.toLowerCase()} priority).`,
      },
    });
  });
}

/**
 * Resolve a support request. Any staff member with RESPOND_SUPPORT permission
 * can resolve any ticket they view — no two-key approval required.
 * Permission check is done by the caller (see requireStaffPermission in
 * the Server Action wrapper).
 */
export async function resolveRequest(requestId: string, actingStaffId: string) {
  const request = await prisma.supportRequest.findUniqueOrThrow({ where: { id: requestId } });

  await prisma.$transaction(async (tx) => {
    await tx.supportRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.RESOLVED, resolvedAt: new Date(), resolvedByStaffId: actingStaffId },
    });
    await recordAuditEvent(tx, {
      actorStaffId: actingStaffId,
      subjectType: "support_request",
      subjectId: requestId,
      action: "support_request.resolved",
      description: "Support request marked resolved",
    });
    if (request.candidateId) {
      await tx.notification.create({
        data: {
          candidateId: request.candidateId,
          category: "SUPPORT",
          title: "Your request has been resolved",
          body: `"${request.subject}" has been marked resolved. Reply to this thread if you need further help.`,
        },
      });
    }
  });
}

/**
 * Reopens a RESOLVED request — a no-op for any other status. Lands back
 * on IN_PROGRESS if it still has an assignee, OPEN otherwise (README
 * B3/B5 rule 5). `actingStaffId` is null for the automatic trigger (a
 * candidate reply reopening a closed thread), non-null for a staff
 * member reopening it directly.
 */
export async function reopenRequest(requestId: string, actingStaffId: string | null) {
  const request = await prisma.supportRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.status !== RequestStatus.RESOLVED) return;

  await prisma.$transaction(async (tx) => {
    await tx.supportRequest.update({
      where: { id: requestId },
      data: {
        status: request.assignedStaffId ? RequestStatus.IN_PROGRESS : RequestStatus.OPEN,
        resolvedAt: null,
        resolvedByStaffId: null,
      },
    });
    await recordAuditEvent(tx, {
      actorStaffId: actingStaffId,
      subjectType: "support_request",
      subjectId: requestId,
      action: "support_request.reopened",
      description: actingStaffId ? "Reopened by a staff member" : "Reopened automatically by a candidate reply",
    });
    // README F rule 1: reopening notifies whoever closed it — captured
    // BEFORE the update above clears resolvedByStaffId, and only when a
    // candidate's own reply triggered the reopen (a staff member
    // reopening it themselves doesn't need telling).
    if (!actingStaffId && request.resolvedByStaffId) {
      await tx.notification.create({
        data: {
          staffId: request.resolvedByStaffId,
          category: "SUPPORT",
          title: "A request you resolved was reopened",
          body: `"${request.subject}" was reopened by a candidate reply.`,
        },
      });
    }
  });
}

/** README F: the "New request" form for a signed-in candidate — distinct from the anonymous marketing-site enquiry (enquiry.ts), which has no candidateId. */
export async function submitCandidateRequest(candidateId: string, input: { subject: string; category: RequestCategory; body: string }) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) throw new Error("Subject and message are required.");

  return prisma.supportRequest.create({
    data: { candidateId, subject, category: input.category, body },
  });
}

/**
 * A candidate's own reply to their request — reopens it automatically if
 * it was RESOLVED (README B3/B5 rule 5). No portal UI calls this yet
 * (the candidate Support screen is still a placeholder from an earlier
 * slice); the rule and this function are real and tested regardless.
 */
export async function submitCandidateReply(requestId: string, candidateId: string, body: string) {
  const request = await prisma.supportRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.candidateId !== candidateId) throw new Error("This request does not belong to you.");

  await prisma.supportMessage.create({ data: { requestId, authorCandidateId: candidateId, body } });
  if (request.status === RequestStatus.RESOLVED) await reopenRequest(requestId, null);
}

/** Internal-only, never candidate-visible, never edited or deleted (a correction is a new note). */
export async function addCandidateNote(candidateId: string, staffId: string, body: string) {
  return prisma.candidateNote.create({ data: { candidateId, authorStaffId: staffId, body } });
}
