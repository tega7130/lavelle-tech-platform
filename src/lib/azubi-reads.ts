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

// ─── Applications (the fellows pool) ───────────────────────────────────

export interface ListAzubiApplicationsParams {
  pipelineStatus?: string;
  statusKind?: string;
  workingMode?: string;
  area?: string;
  /** "unassigned" | "assigned" | "suspended" | undefined (any) */
  poolStatus?: string;
  organizationId?: string;
  supervisorId?: string;
  /** Matches full name or email, case-insensitive. */
  q?: string;
  cursor?: string;
}

export async function listAzubiApplications(params: ListAzubiApplicationsParams) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  const { pipelineStatus, statusKind, workingMode, area, poolStatus, organizationId, supervisorId, q, cursor } = params;

  const poolStatusFilter =
    poolStatus === "suspended"
      ? { suspended: true }
      : poolStatus === "assigned"
        ? { suspended: false, assignedOrganizationId: { not: null } }
        : poolStatus === "unassigned"
          ? { suspended: false, assignedOrganizationId: null }
          : {};

  const where: NonNullable<Parameters<typeof prisma.azubiApplication.findMany>[0]>["where"] = {
    AND: [
      pipelineStatus ? { pipelineStatus: pipelineStatus as never } : {},
      statusKind ? { statusKind: statusKind as never } : {},
      workingMode ? { workingMode: workingMode as never } : {},
      area ? { areas: { has: area } } : {},
      organizationId ? { assignedOrganizationId: organizationId } : {},
      supervisorId ? { assignedSupervisorId: supervisorId } : {},
      poolStatusFilter,
      q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
    ],
  };

  const rows = await prisma.azubiApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CURSOR_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      assignedToStaff: { select: { id: true, name: true } },
      assignedOrganization: { select: { id: true, name: true } },
      assignedSupervisor: { select: { id: true, name: true } },
    },
  });

  const hasMore = rows.length > CURSOR_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, CURSOR_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}

export async function getAzubiApplication(id: string) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiApplication.findUnique({
    where: { id },
    include: {
      assignedToStaff: { select: { id: true, name: true } },
      assignedOrganization: { select: { id: true, name: true } },
      assignedSupervisor: { select: { id: true, name: true } },
    },
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

// ─── Organizations (host law firms / legal organisations) ──────────────

export async function listAzubiOrganizations(q?: string) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiOrganization.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    include: { _count: { select: { fellows: true } } },
  });
}

export async function getAzubiOrganization(id: string) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiOrganization.findUnique({
    where: { id },
    include: {
      fellows: {
        orderBy: { createdAt: "desc" },
        include: { assignedSupervisor: { select: { id: true, name: true } } },
      },
    },
  });
}

/** For the "Assign organization" picker — every org, lightest shape. */
export async function listAzubiOrganizationOptions() {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiOrganization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** For the "Add fellow" picker on an organization's own page — fellows with no organization yet. */
export async function listAzubiUnassignedFellowOptions() {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiApplication.findMany({
    where: { assignedOrganizationId: null, suspended: false },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, email: true },
  });
}

// ─── Supervisors (Azubi-side, distinct from an org's own contact) ──────

export async function listAzubiSupervisors() {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiSupervisor.findMany({
    orderBy: { name: "asc" },
    include: { staff: { select: { id: true, name: true } }, _count: { select: { fellows: true } } },
  });
}

export async function getAzubiSupervisor(id: string) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiSupervisor.findUnique({
    where: { id },
    include: {
      staff: { select: { id: true, name: true } },
      fellows: { orderBy: { createdAt: "desc" }, include: { assignedOrganization: { select: { id: true, name: true } } } },
    },
  });
}

/** For the "Assign supervisor" picker. */
export async function listAzubiSupervisorOptions() {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.azubiSupervisor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// ─── Matching suggestions ────────────────────────────────────────────

const AREA_LABELS: Record<string, string> = {
  corporate_commercial: "corporate",
  litigation_dispute: "litigation",
  property_land: "property",
  research_policy: "research",
  other: "other",
};

/**
 * Rule-based org suggestions for one fellow — no ML, just: does the org's
 * free-text fellow-level preference loosely match this fellow's status,
 * does its free-text practice-area preference mention any area the
 * fellow is interested in, and is there capacity headroom. Orgs at or
 * over capacity are excluded outright rather than just deprioritised.
 */
export async function getAzubiOrganizationMatches(fellowId: string) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);

  const fellow = await prisma.azubiApplication.findUnique({
    where: { id: fellowId },
    select: { statusKind: true, areas: true },
  });
  if (!fellow) return [];

  const organizations = await prisma.azubiOrganization.findMany({
    include: { _count: { select: { fellows: true } } },
  });

  const statusLabel = fellow.statusKind.toLowerCase().replace("_", " ");

  return organizations
    .filter((o) => o.capacity == null || o._count.fellows < o.capacity)
    .map((o) => {
      let score = 0;
      const reasons: string[] = [];

      if (!o.preferredFellowLevel) {
        score += 1;
      } else if (o.preferredFellowLevel.toLowerCase().includes(statusLabel) || o.preferredFellowLevel.toLowerCase().includes("any")) {
        score += 2;
        reasons.push(`wants ${o.preferredFellowLevel}`);
      }

      if (o.preferredPracticeAreas) {
        const text = o.preferredPracticeAreas.toLowerCase();
        for (const area of fellow.areas) {
          const keyword = AREA_LABELS[area];
          if (keyword && text.includes(keyword)) {
            score += 1;
            reasons.push(`interested in ${keyword}`);
          }
        }
      }

      if (o.capacity != null) {
        score += (o.capacity - o._count.fellows) > 0 ? 0.5 : 0;
      }

      return { id: o.id, name: o.name, capacity: o.capacity, assigned: o._count.fellows, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ─── Activity log ────────────────────────────────────────────────────

/** Every logged change for one fellow, organisation or supervisor — reuses the platform-wide AuditEvent table. */
export async function getAzubiActivityLog(subjectType: "AzubiApplication" | "AzubiOrganization" | "AzubiSupervisor", subjectId: string) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  return prisma.auditEvent.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
}

const AZUBI_SUBJECT_TYPES = ["AzubiApplication", "AzubiOrganization", "AzubiSupervisor"] as const;

export interface ListAzubiActivityLogParams {
  subjectType?: string;
  performedBy?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

/** The full cross-entity Azubi audit trail — every fellow, organization and supervisor event in one feed. */
export async function listAzubiActivityLog(params: ListAzubiActivityLogParams) {
  await requireStaffPermission(Permission.MANAGE_AZUBI);
  const { subjectType, performedBy, from, to, cursor } = params;

  const where: NonNullable<Parameters<typeof prisma.auditEvent.findMany>[0]>["where"] = {
    AND: [
      { subjectType: subjectType ? subjectType : { in: [...AZUBI_SUBJECT_TYPES] } },
      performedBy ? { actorStaffId: performedBy } : {},
      from || to ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined } } : {},
    ],
  };

  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CURSOR_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    include: { actor: { select: { id: true, name: true } } },
  });

  const hasMore = rows.length > CURSOR_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, CURSOR_PAGE_SIZE) : rows;
  return { items, nextCursor: hasMore ? String(items[items.length - 1]!.id) : null };
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

// ─── Analytics ───────────────────────────────────────────────────────

const WEEKS_OF_HISTORY = 12;

/** Everything the analytics dashboard needs — bucketed in JS, not SQL, since the pilot's data volume is small. */
export async function getAzubiAnalytics() {
  await requireStaffPermission(Permission.MANAGE_AZUBI);

  const [fellows, organizations, supervisorCount] = await Promise.all([
    prisma.azubiApplication.findMany({
      select: { createdAt: true, areas: true, suspended: true, assignedOrganizationId: true, pipelineStatus: true },
    }),
    prisma.azubiOrganization.findMany({
      select: { id: true, name: true, capacity: true, _count: { select: { fellows: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.azubiSupervisor.count(),
  ]);

  const unassigned = fellows.filter((f) => !f.suspended && !f.assignedOrganizationId).length;
  const assigned = fellows.filter((f) => !f.suspended && f.assignedOrganizationId).length;
  const suspended = fellows.filter((f) => f.suspended).length;

  const pipelineCounts: Record<string, number> = {};
  for (const f of fellows) pipelineCounts[f.pipelineStatus] = (pipelineCounts[f.pipelineStatus] ?? 0) + 1;

  const areaCounts: Record<string, number> = {};
  for (const f of fellows) for (const area of f.areas) areaCounts[area] = (areaCounts[area] ?? 0) + 1;

  // Weekly buckets, oldest first, each labelled by the Monday it starts on.
  const now = new Date();
  const weekBuckets: { weekStart: string; count: number }[] = [];
  for (let i = WEEKS_OF_HISTORY - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay() - i * 7 + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const count = fellows.filter((f) => f.createdAt >= weekStart && f.createdAt < weekEnd).length;
    weekBuckets.push({ weekStart: weekStart.toISOString().slice(0, 10), count });
  }

  return {
    totals: { fellows: fellows.length, unassigned, assigned, suspended, organizations: organizations.length, supervisors: supervisorCount },
    pipelineCounts,
    areaCounts,
    weekBuckets,
    organizations: organizations.map((o) => ({ id: o.id, name: o.name, capacity: o.capacity, assigned: o._count.fellows })),
  };
}
