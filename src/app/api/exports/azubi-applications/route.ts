import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/request-info";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  let staff;
  try {
    staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await prisma.azubiApplication.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignedToStaff: { select: { name: true } } },
  });

  const header = [
    "Full name",
    "Email",
    "Phone",
    "Country",
    "State",
    "Current status",
    "Institution",
    "Working mode",
    "Areas",
    "Other area (detail)",
    "Pipeline status",
    "Status confirmed",
    "Assigned to",
    "Submitted at",
  ];
  const csvRows = rows.map((r) => [
    r.fullName,
    r.email,
    r.phone,
    r.country,
    r.state,
    r.statusKind,
    r.institution,
    r.workingMode,
    r.areas.join("; "),
    r.otherAreaDetail ?? "",
    r.pipelineStatus,
    r.statusConfirmedAt ? "Yes" : "No",
    r.assignedToStaff?.name ?? "",
    r.createdAt.toISOString(),
  ]);

  const csv = [header, ...csvRows].map((r) => r.map((v) => csvEscape(String(v))).join(",")).join("\n");

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "export",
    subjectId: "azubi-applications",
    action: "azubi_applications.exported",
    description: `Exported Azubi applications CSV — ${rows.length} row${rows.length === 1 ? "" : "s"}`,
    ipAddress: await getClientIp(),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="azubi-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
