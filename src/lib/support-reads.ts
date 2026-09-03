import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission, RequestStatus, RequestCategory } from "@/generated/prisma/client";

export interface ListSupportRequestsParams {
  status?: RequestStatus;
  category?: RequestCategory;
  assignedToMe?: string; // staffId, when the "assigned to me" filter is active
}

export async function listSupportRequests(params: ListSupportRequestsParams = {}) {
  await requireStaffPermission(Permission.RESPOND_SUPPORT);
  return prisma.supportRequest.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.assignedToMe ? { assignedStaffId: params.assignedToMe } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, candidateNumber: true, applicantNumber: true } },
      assignedStaff: { select: { name: true } },
    },
  });
}

export async function getSupportRequestThread(id: string) {
  await requireStaffPermission(Permission.RESPOND_SUPPORT);
  return prisma.supportRequest.findUnique({
    where: { id },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, candidateNumber: true, applicantNumber: true, email: true } },
      assignedStaff: { select: { id: true, name: true } },
      assignedByStaff: { select: { name: true } },
      resolvedByStaff: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { authorStaff: { select: { name: true } }, authorCandidate: { select: { firstName: true, lastName: true } } },
      },
    },
  });
}

/**
 * Staff holding respond_support, each with their CURRENT open count
 * (README B2: "the load figure is the point — assigning blind is how
 * one agent ends up with everything"). Filtered from permissions, never
 * from role names (rule 1).
 */
export async function listAssignableStaff() {
  await requireStaffPermission(Permission.RESPOND_SUPPORT);
  const staff = await prisma.staff.findMany({
    where: { status: "ACTIVE", permissionGrants: { some: { permission: Permission.RESPOND_SUPPORT } } },
    select: { id: true, name: true, jobTitle: true, department: true },
    orderBy: { name: "asc" },
  });
  if (staff.length === 0) return [];

  const counts = await prisma.supportRequest.groupBy({
    by: ["assignedStaffId"],
    where: { assignedStaffId: { in: staff.map((s) => s.id) }, status: { not: RequestStatus.RESOLVED } },
    _count: { _all: true },
  });
  const openCountByStaffId = new Map(counts.map((c) => [c.assignedStaffId, c._count._all]));

  return staff.map((s) => ({ ...s, openCount: openCountByStaffId.get(s.id) ?? 0 }));
}

/** README F rule 2: scoped by the session's candidate — no staff permission check, this is the candidate's own record. */
export async function listMyRequests(candidateId: string) {
  return prisma.supportRequest.findMany({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    select: { id: true, subject: true, category: true, status: true, priority: true, createdAt: true },
  });
}

export async function countOpenSupportRequests() {
  return prisma.supportRequest.count({ where: { status: RequestStatus.OPEN } });
}

/**
 * README F rule 2: never accept a request id alone — a mismatched
 * candidateId returns null exactly like a request that doesn't exist,
 * so a guessed id leaks nothing about whether it's real.
 */
export async function getMyRequestThread(requestId: string, candidateId: string) {
  const request = await prisma.supportRequest.findUnique({
    where: { id: requestId },
    include: {
      resolvedByStaff: { select: { name: true } },
      // README F rule 3: internal notes and decline reasons never appear
      // here — only SupportMessage rows, and only the author fields a
      // candidate is entitled to see.
      messages: {
        orderBy: { createdAt: "asc" },
        include: { authorStaff: { select: { name: true } }, authorCandidate: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!request || request.candidateId !== candidateId) return null;
  return request;
}
