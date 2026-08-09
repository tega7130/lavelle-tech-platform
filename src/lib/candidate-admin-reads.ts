import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";

const CURSOR_PAGE_SIZE = 25;

export interface ListCandidatesParams {
  q?: string;
  status?: "APPLICANT" | "ENROLLED" | "SUSPENDED";
  programmeId?: string;
  intakeId?: string;
  cursor?: string;
}

/**
 * The Candidates directory (Slice 08) — cursor-paginated rather than
 * offset (README: large candidate volumes over time). Status here is a
 * derived filter, not a stored column: APPLICANT = no active/completed
 * enrolment yet, ENROLLED = has one, SUSPENDED = accountStatus SUSPENDED
 * on the account itself (independent of enrolment state).
 */
export async function listCandidates(params: ListCandidatesParams) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const { q, status, programmeId, intakeId, cursor } = params;

  const where: NonNullable<Parameters<typeof prisma.candidate.findMany>[0]>["where"] = {
    AND: [
      q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { applicantNumber: { contains: q, mode: "insensitive" } },
              { candidateNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      status === "SUSPENDED" ? { accountStatus: "SUSPENDED" } : {},
      status === "ENROLLED" ? { enrolments: { some: { status: { in: ["ACTIVE", "COMPLETED"] } } } } : {},
      status === "APPLICANT" ? { enrolments: { none: { status: { in: ["ACTIVE", "COMPLETED"] } } } } : {},
      programmeId ? { enrolments: { some: { programmeId } } } : {},
      intakeId ? { enrolments: { some: { cohort: { intakeId } } } } : {},
    ],
  };

  const rows = await prisma.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CURSOR_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      enrolments: {
        where: { status: { in: ["ACTIVE", "COMPLETED"] } },
        select: { programme: { select: { title: true, tier: true } } },
        take: 1,
      },
    },
  });

  const hasMore = rows.length > CURSOR_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, CURSOR_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}

export async function getCandidateForAdmin(id: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  return prisma.candidate.findUnique({ where: { id }, include: { profile: true } });
}

/**
 * The Overview tab: identity, profile, and a small set of cross-tab
 * summary counts (so a staff member doesn't have to open every other
 * tab to know whether there's anything there).
 */
export async function getCandidateOverview(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const [candidate, enrolmentCount, paymentCount, certificateCount, openRequestCount] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: candidateId }, include: { profile: true } }),
    prisma.enrolment.count({ where: { candidateId } }),
    prisma.payment.count({ where: { candidateId } }),
    prisma.certificate.count({ where: { candidateId } }),
    prisma.supportRequest.count({ where: { candidateId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  return { candidate, enrolmentCount, paymentCount, certificateCount, openRequestCount };
}

/** The Notes & requests tab — internal notes and the candidate's support thread history, newest first. */
export async function getCandidateNotesAndRequests(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const [notes, requests] = await Promise.all([
    prisma.candidateNote.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
      include: { authorStaff: { select: { name: true } } },
    }),
    prisma.supportRequest.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
      include: {
        assignedStaff: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { authorStaff: { select: { name: true } } } },
      },
    }),
  ]);
  return { notes, requests };
}

/** The Audit log tab — every event recorded directly against this candidate. */
export async function getCandidateAuditEvents(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_AUDIT_LOG);
  return prisma.auditEvent.findMany({
    where: { subjectType: "candidate", subjectId: candidateId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
}

/** The Certificates tab — admin-facing, so revoked/superseded rows are shown same as active (no candidate-facing filtering). */
export async function getCandidateCertificatesForAdmin(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  return prisma.certificate.findMany({
    where: { candidateId },
    orderBy: { issuedAt: "desc" },
    include: { programme: { select: { title: true, code: true } } },
  });
}
