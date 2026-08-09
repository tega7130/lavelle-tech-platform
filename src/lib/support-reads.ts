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
      assignedStaff: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { authorStaff: { select: { name: true } }, authorCandidate: { select: { firstName: true, lastName: true } } },
      },
    },
  });
}
