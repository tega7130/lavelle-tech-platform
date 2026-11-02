import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/request-info";

const AZUBI_SUBJECT_TYPES = ["AzubiApplication", "AzubiOrganization", "AzubiSupervisor"] as const;

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: NextRequest) {
  let staff;
  try {
    staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const subjectType = searchParams.get("subjectType") || undefined;
  const performedBy = searchParams.get("performedBy") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const rows = await prisma.auditEvent.findMany({
    where: {
      AND: [
        { subjectType: subjectType ? subjectType : { in: [...AZUBI_SUBJECT_TYPES] } },
        performedBy ? { actorStaffId: performedBy } : {},
        from || to ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined } } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });

  const header = ["Date", "Subject type", "Action", "Description", "Performed by"];
  const csvRows = rows.map((r) => [r.createdAt.toISOString(), r.subjectType, r.action, r.description, r.actor?.name ?? "System"]);

  const csv = [header, ...csvRows].map((r) => r.map((v) => csvEscape(String(v))).join(",")).join("\n");

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "export",
    subjectId: "azubi-activity-log",
    action: "azubi_activity_log.exported",
    description: `Exported Azubi activity log CSV — ${rows.length} row${rows.length === 1 ? "" : "s"}`,
    ipAddress: await getClientIp(),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="azubi-activity-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
