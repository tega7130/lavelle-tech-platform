import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";

const CURSOR_PAGE_SIZE = 25;

// ─── Overview ──────────────────────────────────────────────────────────

export async function getAzubiOverview() {
  await requireStaffPermission(Permission.MANAGE_AZUBI);

  const [newApplications, newEnquiries, latestApplications, latestEnquiries] = await Promise.all([
    prisma.azubiApplication.count({ where: { pipelineStatus: "NEW" } }),
    prisma.azubiEnquiry.count({ where: { status: "NEW" } }),
    prisma.azubiApplication.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.azubiEnquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return { newApplications, newEnquiries, latestApplications, latestEnquiries };
}

// ─── Applications ──────────────────────────────────────────────────────

export interface ListAzubiApplicationsParams {
  pipelineStatus?: string;
  statusKind?: string;
  workingMode?: string;
  area?: string;
  cursor?: string;
}

export async function listAzubiApplications(params: ListAzubiApplicationsParams) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  const { pipelineStatus, statusKind, workingMode, area, cursor } = params;

  const where: NonNullable<Parameters<typeof prisma.azubiApplication.findMany>[0]>["where"] = {
    AND: [
      pipelineStatus ? { pipelineStatus: pipelineStatus as never } : {},
      statusKind ? { statusKind: statusKind as never } : {},
      workingMode ? { workingMode: workingMode as never } : {},
      area ? { areas: { has: area } } : {},
    ],
  };

  const rows = await prisma.azubiApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CURSOR_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { assignedToStaff: { select: { id: true, name: true } } },
  });

  const hasMore = rows.length > CURSOR_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, CURSOR_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}

export async function getAzubiApplication(id: string) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiApplication.findUnique({
    where: { id },
    include: { assignedToStaff: { select: { id: true, name: true } } },
  });
}

// ─── Enquiries ─────────────────────────────────────────────────────────

export interface ListAzubiEnquiriesParams {
  writingAs?: string;
  status?: string;
  cursor?: string;
}

export async function listAzubiEnquiries(params: ListAzubiEnquiriesParams) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  const { writingAs, status, cursor } = params;

  const where: NonNullable<Parameters<typeof prisma.azubiEnquiry.findMany>[0]>["where"] = {
    AND: [writingAs ? { writingAs: writingAs as never } : {}, status ? { status: status as never } : {}],
  };

  const rows = await prisma.azubiEnquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CURSOR_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { assignedToStaff: { select: { id: true, name: true } } },
  });

  const hasMore = rows.length > CURSOR_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, CURSOR_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}

export async function getAzubiEnquiry(id: string) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiEnquiry.findUnique({
    where: { id },
    include: { assignedToStaff: { select: { id: true, name: true } } },
  });
}

// ─── Shared ────────────────────────────────────────────────────────────

/** Staff who can be assigned an application/enquiry — anyone holding MANAGE_AZUBI. */
export async function listAzubiAssignableStaff() {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  const grants = await prisma.staffPermission.findMany({
    where: { permission: "MANAGE_AZUBI", staff: { status: "ACTIVE" } },
    select: { staff: { select: { id: true, name: true } } },
    orderBy: { staff: { name: "asc" } },
  });
  return grants.map((g) => g.staff);
}
