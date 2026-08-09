import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/request-info";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * CSV export, permission-gated — and the export itself is an audit event
 * (rule 9), not just the data it exposes. A candidate row with no
 * ProgrammeResult yet (nothing marked so far) exports blank cells rather
 * than being skipped, so the cohort roster stays complete.
 */
export async function GET(request: NextRequest) {
  let staff;
  try {
    staff = await requireStaffPermission(Permission.MARK_SUBMISSIONS);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const programmeId = request.nextUrl.searchParams.get("programmeId");
  const cohortId = request.nextUrl.searchParams.get("cohortId");

  const enrolments = await prisma.enrolment.findMany({
    where: {
      ...(programmeId ? { programmeId } : {}),
      ...(cohortId ? { cohortId } : {}),
      status: { in: ["ACTIVE", "COMPLETED"] },
    },
    include: { candidate: true, programme: true, cohort: true, programmeResult: true },
    orderBy: { candidate: { lastName: "asc" } },
  });

  const header = ["Candidate number", "Candidate name", "Programme", "Cohort", "Quiz avg", "Drafting avg", "Examination", "Final", "Band", "Provisional"];
  const rows = enrolments.map((e) => [
    e.candidate.candidateNumber ?? "",
    `${e.candidate.firstName} ${e.candidate.lastName}`,
    e.programme.title,
    e.cohort?.code ?? "",
    e.programmeResult?.quizAveragePercent?.toString() ?? "",
    e.programmeResult?.draftingAveragePercent?.toString() ?? "",
    e.programmeResult?.examinationPercent?.toString() ?? "",
    e.programmeResult?.finalPercent?.toString() ?? "",
    e.programmeResult?.band ?? "",
    e.programmeResult?.isProvisional ? "Yes" : "No",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  const ip = await getClientIp();
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "export",
    subjectId: programmeId ?? "all-programmes",
    action: "grades.exported",
    description: `Exported grades CSV — ${enrolments.length} row${enrolments.length === 1 ? "" : "s"}${programmeId ? " (filtered by programme)" : ""}${cohortId ? " (filtered by cohort)" : ""}`,
    ipAddress: ip,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="grades-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
