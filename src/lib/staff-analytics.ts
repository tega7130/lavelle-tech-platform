import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission, type StaffRole, type StaffStatus } from "@/generated/prisma/client";

export interface StaffPerformanceRow {
  staffId: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  marksReturned: number;
  avgMarkingTurnaroundHours: number | null; // markedAt - createdAt (queue entry), averaged
  invigilationReviews: number; // Sitting.conductReview cleared/referred by this staff member
  supportResolved: number;
  blogPostsPublished: number;
}

/**
 * Per-staff activity across the four things this codebase actually
 * attributes to an individual staff member (markedByStaffId,
 * reviewedByStaffId, resolvedByStaffId, publishedByStaffId) — every
 * other staff-authored action (programme edits, announcements, etc.)
 * has no such column, so isn't included rather than guessed at.
 * Turnaround is measured from a Mark's createdAt (when it entered the
 * queue) to markedAt (when a mark was first entered), same signal the
 * marking queue itself is built around.
 */
export async function getStaffPerformanceStats(): Promise<StaffPerformanceRow[]> {
  await requireStaffPermission(Permission.MANAGE_STAFF);

  const staff = await prisma.staff.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, status: true },
  });
  const staffIds = staff.map((s) => s.id);
  if (staffIds.length === 0) return [];

  const [marks, reviewGroups, resolvedGroups, publishedGroups] = await Promise.all([
    prisma.mark.findMany({
      where: { markedByStaffId: { in: staffIds }, markedAt: { not: null } },
      select: { markedByStaffId: true, markedAt: true, createdAt: true },
    }),
    prisma.sitting.groupBy({ by: ["reviewedByStaffId"], where: { reviewedByStaffId: { in: staffIds } }, _count: { _all: true } }),
    prisma.supportRequest.groupBy({ by: ["resolvedByStaffId"], where: { resolvedByStaffId: { in: staffIds } }, _count: { _all: true } }),
    prisma.blogPost.groupBy({ by: ["publishedByStaffId"], where: { publishedByStaffId: { in: staffIds } }, _count: { _all: true } }),
  ]);

  const marksByStaff = new Map<string, { count: number; totalHours: number; measuredCount: number }>();
  for (const m of marks) {
    if (!m.markedByStaffId || !m.markedAt) continue;
    const existing = marksByStaff.get(m.markedByStaffId) ?? { count: 0, totalHours: 0, measuredCount: 0 };
    existing.count++;
    const hours = (m.markedAt.getTime() - m.createdAt.getTime()) / (1000 * 60 * 60);
    // A negative duration means markedAt predates createdAt — never true
    // in real usage (a submission enters the queue before anyone marks
    // it), but backdated seed/demo data can produce it; excluded from
    // the average rather than shown as a nonsense negative turnaround.
    if (hours >= 0) {
      existing.totalHours += hours;
      existing.measuredCount++;
    }
    marksByStaff.set(m.markedByStaffId, existing);
  }
  const reviewsByStaff = new Map(reviewGroups.map((r) => [r.reviewedByStaffId, r._count._all]));
  const resolvedByStaff = new Map(resolvedGroups.map((r) => [r.resolvedByStaffId, r._count._all]));
  const publishedByStaff = new Map(publishedGroups.map((r) => [r.publishedByStaffId, r._count._all]));

  return staff.map((s) => {
    const markInfo = marksByStaff.get(s.id);
    return {
      staffId: s.id,
      name: s.name,
      role: s.role,
      status: s.status,
      marksReturned: markInfo?.count ?? 0,
      avgMarkingTurnaroundHours:
        markInfo && markInfo.measuredCount > 0 ? Math.round((markInfo.totalHours / markInfo.measuredCount) * 10) / 10 : null,
      invigilationReviews: reviewsByStaff.get(s.id) ?? 0,
      supportResolved: resolvedByStaff.get(s.id) ?? 0,
      blogPostsPublished: publishedByStaff.get(s.id) ?? 0,
    };
  });
}
