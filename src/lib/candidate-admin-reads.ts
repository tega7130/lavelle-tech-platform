import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";

const CURSOR_PAGE_SIZE = 25;

export type DirectoryStatus = "APPLICANT" | "ACTIVE" | "AT_RISK" | "COMPLETED" | "SUSPENDED";
export type DirectoryPaymentStatus = "PAID" | "UNPAID" | "OUTSTANDING";

const AT_RISK_STALE_DAYS = 30;

export interface ListCandidatesParams {
  q?: string;
  status?: DirectoryStatus;
  programmeId?: string;
  intakeId?: string;
  cursor?: string;
}

/**
 * The Candidates directory — cursor-paginated (README: large candidate
 * volumes over time). ACTIVE/AT_RISK/COMPLETED are derived from live
 * progress and payment data, not a stored column (nothing in this app
 * ever sets Enrolment.status to COMPLETED — see dashboard-reads.ts), so
 * unlike the SQL-level filters (search, SUSPENDED, APPLICANT), those
 * three are applied to the page AFTER it's fetched. That means a filtered
 * page can come back with fewer than CURSOR_PAGE_SIZE rows even when more
 * exist — "Load more" still advances the cursor correctly, it just may
 * take an extra click. Building a denormalized, continuously-recomputed
 * status column is a bigger job than this directory needs right now.
 */
export async function listCandidates(params: ListCandidatesParams) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const { q, status, programmeId, intakeId, cursor } = params;
  const derivedFilter = status === "ACTIVE" || status === "AT_RISK" || status === "COMPLETED" ? status : null;

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
      status === "APPLICANT" ? { candidateNumber: null } : {},
      derivedFilter ? { candidateNumber: { not: null }, accountStatus: "ACTIVE" } : {},
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
        select: { id: true, programmeId: true, enrolledAt: true, programme: { select: { title: true, tier: true } } },
        orderBy: { enrolledAt: "desc" },
      },
    },
  });

  const hasMore = rows.length > CURSOR_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, CURSOR_PAGE_SIZE) : rows;

  const enrolmentIds = page.flatMap((c) => c.enrolments.map((e) => e.id));
  const programmeIds = [...new Set(page.flatMap((c) => c.enrolments.map((e) => e.programmeId)))];

  const [completedByEnrolment, lecturesByProgramme, paymentsByEnrolment] = await Promise.all([
    enrolmentIds.length
      ? prisma.lectureProgress.groupBy({ by: ["enrolmentId"], where: { enrolmentId: { in: enrolmentIds }, state: "COMPLETED" }, _count: true })
      : [],
    programmeIds.length
      ? prisma.module.findMany({ where: { programmeId: { in: programmeIds } }, select: { programmeId: true, _count: { select: { lectures: true } } } })
      : [],
    enrolmentIds.length
      ? prisma.payment.findMany({ where: { enrolmentId: { in: enrolmentIds } }, orderBy: { createdAt: "desc" }, select: { enrolmentId: true, status: true } })
      : [],
  ]);

  const completedMap = new Map(completedByEnrolment.map((r) => [r.enrolmentId, r._count]));
  const totalByProgramme = new Map<string, number>();
  for (const m of lecturesByProgramme) totalByProgramme.set(m.programmeId, (totalByProgramme.get(m.programmeId) ?? 0) + m._count.lectures);
  const paymentByEnrolment = new Map<string, "SUCCESS" | "PENDING" | "FAILED" | "REFUNDED">();
  for (const p of paymentsByEnrolment) if (!paymentByEnrolment.has(p.enrolmentId!)) paymentByEnrolment.set(p.enrolmentId!, p.status);

  const now = Date.now();
  const items = page.map((c) => {
    let programmesFullyDone = c.enrolments.length > 0;
    for (const e of c.enrolments) {
      const eCompleted = completedMap.get(e.id) ?? 0;
      const eTotal = totalByProgramme.get(e.programmeId) ?? 0;
      if (!(eTotal > 0 && eCompleted === eTotal)) programmesFullyDone = false;
    }

    // The PROGRESS column mirrors the PROGRAMME column — the primary
    // (most recently enrolled) programme's own completion, never an
    // aggregate across every programme the candidate holds, which would
    // silently mismatch the single programme title shown next to it.
    const primary = c.enrolments[0] ?? null;
    const primaryTotal = primary ? (totalByProgramme.get(primary.programmeId) ?? 0) : 0;
    const primaryCompleted = primary ? (completedMap.get(primary.id) ?? 0) : 0;
    const percent = primary && primaryTotal > 0 ? Math.round((primaryCompleted / primaryTotal) * 100) : null;

    const primaryPayment = primary ? paymentByEnrolment.get(primary.id) : undefined;
    const payment: DirectoryPaymentStatus = primaryPayment === "SUCCESS" ? "PAID" : primaryPayment === "FAILED" ? "OUTSTANDING" : "UNPAID";

    let derivedStatus: DirectoryStatus;
    if (c.accountStatus === "SUSPENDED") derivedStatus = "SUSPENDED";
    else if (!c.candidateNumber) derivedStatus = "APPLICANT";
    else if (programmesFullyDone) derivedStatus = "COMPLETED";
    else if (
      payment === "OUTSTANDING" ||
      (primary && percent === 0 && now - primary.enrolledAt!.getTime() > AT_RISK_STALE_DAYS * 86_400_000)
    )
      derivedStatus = "AT_RISK";
    else derivedStatus = "ACTIVE";

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      applicantNumber: c.applicantNumber,
      candidateNumber: c.candidateNumber,
      accountStatus: c.accountStatus,
      programmeTitle: primary?.programme.title ?? null,
      percent,
      payment,
      status: derivedStatus,
    };
  });

  const filtered = derivedFilter ? items.filter((i) => i.status === derivedFilter) : items;
  return { items: filtered, nextCursor: hasMore ? page[page.length - 1]!.id : null };
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
