import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";

export async function listStaff() {
  await requireStaffPermission(Permission.MANAGE_STAFF);
  return prisma.staff.findMany({
    orderBy: { createdAt: "asc" },
    include: { permissionGrants: { select: { permission: true } } },
  });
}

export async function getStaffMember(id: string) {
  await requireStaffPermission(Permission.MANAGE_STAFF);
  return prisma.staff.findUnique({
    where: { id },
    include: { permissionGrants: { select: { permission: true, grantedAt: true, grantedByStaff: { select: { name: true } } } } },
  });
}

/** Audit log — cursor-paginated, optionally filtered by category (action prefix) and date range. */
export interface ListAuditEventsParams {
  category?: string; // matches the action's dot-prefix, e.g. "candidate", "staff", "certificate"
  from?: Date;
  to?: Date;
  cursor?: string;
}

const AUDIT_PAGE_SIZE = 50;

export async function listAuditEvents(params: ListAuditEventsParams = {}) {
  await requireStaffPermission(Permission.VIEW_AUDIT_LOG);
  const { category, from, to, cursor } = params;

  const rows = await prisma.auditEvent.findMany({
    where: {
      ...(category ? { action: { startsWith: `${category}.` } } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: { id: "desc" },
    take: AUDIT_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    include: { actor: { select: { name: true } } },
  });

  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id.toString() : null };
}
