import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission, PaymentStatus, MarkState } from "@/generated/prisma/client";

const STALE_PENDING_HOURS = 48;

/**
 * The admin Overview screen: headline KPIs plus a derived "needs
 * attention" queue. Nothing here is stored — every number is computed
 * fresh from the tables the other tabs already read, per-widget gated on
 * whatever permission that widget's underlying data requires (a Faculty
 * account sees the marking-queue count but not the finance figures).
 */
export async function getAdminOverview(staffPermissions: Set<Permission>) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const cutoff = new Date(Date.now() - STALE_PENDING_HOURS * 60 * 60 * 1000);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [candidateCount, activeEnrolmentCount] = await Promise.all([
    prisma.candidate.count(),
    prisma.enrolment.count({ where: { status: "ACTIVE" } }),
  ]);

  let financeThisMonthMinor: number | null = null;
  let stalePendingCount = 0;
  if (staffPermissions.has(Permission.VIEW_FINANCE)) {
    const [collected, stale] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCESS, confirmedAt: { gte: monthStart } },
        _sum: { amountMinor: true },
      }),
      prisma.payment.count({ where: { status: PaymentStatus.PENDING, initiatedAt: { lt: cutoff } } }),
    ]);
    financeThisMonthMinor = collected._sum.amountMinor ?? 0;
    stalePendingCount = stale;
  }

  let markingQueueCount: number | null = null;
  if (staffPermissions.has(Permission.MARK_SUBMISSIONS) || staffPermissions.has(Permission.MODERATE_GRADES)) {
    markingQueueCount = await prisma.mark.count({ where: { state: MarkState.AWAITING } });
  }

  let unassignedSupportCount = 0;
  let unansweredSupportCount = 0;
  if (staffPermissions.has(Permission.RESPOND_SUPPORT)) {
    [unassignedSupportCount, unansweredSupportCount] = await Promise.all([
      prisma.supportRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, assignedStaffId: null } }),
      prisma.supportRequest.count({ where: { status: "OPEN", firstRespondedAt: null } }),
    ]);
  }

  const attentionQueue: { label: string; count: number; href: string }[] = [];
  if (stalePendingCount > 0) {
    attentionQueue.push({ label: "Payments pending over 48 hours", count: stalePendingCount, href: "/admin/finance" });
  }
  if (markingQueueCount !== null && markingQueueCount > 0) {
    attentionQueue.push({ label: "Submissions awaiting marking", count: markingQueueCount, href: "/admin/marking" });
  }
  if (unansweredSupportCount > 0) {
    attentionQueue.push({ label: "Support requests unanswered", count: unansweredSupportCount, href: "/admin/support" });
  }

  return {
    candidateCount,
    activeEnrolmentCount,
    financeThisMonthMinor,
    stalePendingCount,
    markingQueueCount,
    unassignedSupportCount,
    unansweredSupportCount,
    attentionQueue,
  };
}

/**
 * Platform-wide recent activity — the last N audit events, any subject.
 * Gated on VIEW_AUDIT_LOG like every other Overview widget (the same
 * graceful per-permission pattern as getAdminOverview above) — a Faculty
 * or Support account can always reach this page (VIEW_CANDIDATES is
 * universal), but neither role holds VIEW_AUDIT_LOG, so this returns an
 * empty list for them rather than throwing.
 */
export async function getRecentActivity(staffPermissions: Set<Permission>, limit = 15) {
  if (!staffPermissions.has(Permission.VIEW_AUDIT_LOG)) return [];
  return prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true } } },
  });
}
