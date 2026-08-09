import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission, PaymentStatus, EnrolmentStatus } from "@/generated/prisma/client";

// Admin-facing server functions for Finance. Gated on VIEW_FINANCE —
// unlike most read functions in this codebase, financial data is
// sensitive enough that even viewing it (not just recording/confirming)
// is its own permission.

const STALE_PENDING_HOURS = 48;

export interface ListLedgerParams {
  from?: Date;
  to?: Date;
  provider?: string;
  status?: PaymentStatus;
}

export async function listLedger(params: ListLedgerParams = {}) {
  await requireStaffPermission(Permission.VIEW_FINANCE);
  return prisma.payment.findMany({
    where: {
      ...(params.from || params.to
        ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
        : {}),
      ...(params.provider ? { provider: params.provider } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, applicantNumber: true, candidateNumber: true } },
      enrolment: { include: { programme: { select: { title: true, code: true } } } },
      receiptAsset: { select: { id: true, originalFilename: true, storageKey: true } },
      confirmedByStaff: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFinanceKpis() {
  await requireStaffPermission(Permission.VIEW_FINANCE);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [collected, outstanding, refunded] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESS, confirmedAt: { gte: monthStart } },
      _sum: { amountMinor: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.PENDING },
      _sum: { amountMinor: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.REFUNDED },
      _sum: { amountMinor: true },
      _count: true,
    }),
  ]);

  return {
    collectedMinor: collected._sum.amountMinor ?? 0,
    collectedCount: collected._count,
    outstandingMinor: outstanding._sum.amountMinor ?? 0,
    outstandingCount: outstanding._count,
    refundedMinor: refunded._sum.amountMinor ?? 0,
    refundedCount: refunded._count,
  };
}

/** The prompt-to-reconcile banner (rule 9) — never an automatic confirmation. */
export async function countStalePendingPayments() {
  const cutoff = new Date(Date.now() - STALE_PENDING_HOURS * 60 * 60 * 1000);
  return prisma.payment.count({ where: { status: PaymentStatus.PENDING, initiatedAt: { lt: cutoff } } });
}

/** Payments pending over 48 hours for one candidate — surfaced on their record's Payments tab. */
export async function candidateHasStalePendingPayment(candidateId: string) {
  const cutoff = new Date(Date.now() - STALE_PENDING_HOURS * 60 * 60 * 1000);
  const count = await prisma.payment.count({
    where: { candidateId, status: PaymentStatus.PENDING, initiatedAt: { lt: cutoff } },
  });
  return count > 0;
}

/**
 * ACTIVE enrolments with no cohort — the standing "admin task" a cohort-
 * capacity shortfall leaves behind (README: "raise an admin task rather
 * than failing the payment"). There is no dedicated task queue in this
 * schema; this query, plus the enrolment.cohort_unavailable audit trail
 * it corresponds to, is that task list.
 */
export async function listUnplacedEnrolments() {
  await requireStaffPermission(Permission.MANAGE_INTAKES_COHORTS);
  return prisma.enrolment.findMany({
    where: { status: EnrolmentStatus.ACTIVE, cohortId: null },
    include: {
      candidate: { select: { firstName: true, lastName: true, candidateNumber: true } },
      programme: { select: { title: true, code: true } },
      intake: true,
    },
    orderBy: { enrolledAt: "asc" },
  });
}

export async function listCandidatePayments(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_FINANCE);
  return prisma.payment.findMany({
    where: { candidateId },
    include: {
      enrolment: { include: { programme: { select: { title: true, code: true } } } },
      receiptAsset: { select: { id: true, originalFilename: true, storageKey: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listCandidateEnrolments(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  return prisma.enrolment.findMany({
    where: { candidateId },
    include: {
      programme: { select: { title: true, code: true, tier: true } },
      cohort: true,
      intake: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
