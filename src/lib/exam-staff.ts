import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffSession, requireStaffPermission, type StaffSessionUser } from "@/lib/staff-auth";
import { PermissionDeniedError } from "@/lib/rbac";
import { Permission } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";

/**
 * Access to one exam's candidate roster, sitting answers and grading —
 * granted either by the blanket MANAGE_EXAMS permission (already lets
 * you build/publish this exam) or by an ExamStaffAssignment row scoping
 * a staff member to THIS exam specifically, without handing them every
 * exam on the platform.
 */
export async function requireExamAccess(examId: string): Promise<StaffSessionUser> {
  const staff = await requireStaffSession();
  if (staff.permissions.includes(Permission.MANAGE_EXAMS)) return staff;

  const assignment = await prisma.examStaffAssignment.findUnique({
    where: { examId_staffId: { examId, staffId: staff.id } },
  });
  if (!assignment) throw new PermissionDeniedError(Permission.MANAGE_EXAMS);
  return staff;
}

/** True if this specific staff member can already reach the exam — used to hide the "already assigned" option in the picker. */
export async function listExamStaffAssignments(examId: string) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const rows = await prisma.examStaffAssignment.findMany({
    where: { examId },
    include: { staff: { select: { id: true, name: true, email: true, role: true } }, assignedByStaff: { select: { name: true } } },
    orderBy: { assignedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    staffId: r.staff.id,
    name: r.staff.name,
    email: r.staff.email,
    role: r.staff.role,
    assignedAt: r.assignedAt,
    assignedByName: r.assignedByStaff.name,
  }));
}

/** Active staff not already assigned to this exam and not already holding MANAGE_EXAMS (who need no assignment) — the picker's option list. */
export async function listAssignableStaffForExam(examId: string) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const [staff, assigned, managers] = await Promise.all([
    prisma.staff.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } }),
    prisma.examStaffAssignment.findMany({ where: { examId }, select: { staffId: true } }),
    prisma.staffPermission.findMany({ where: { permission: Permission.MANAGE_EXAMS }, select: { staffId: true } }),
  ]);
  const excluded = new Set([...assigned.map((a) => a.staffId), ...managers.map((m) => m.staffId)]);
  return staff.filter((s) => !excluded.has(s.id));
}

export async function assignExamStaff(examId: string, staffId: string, actorStaffId: string, ipAddress: string | null) {
  const [exam, staff] = await Promise.all([
    prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { programme: { select: { title: true } } } }),
    prisma.staff.findUniqueOrThrow({ where: { id: staffId } }),
  ]);

  const created = await prisma.examStaffAssignment.upsert({
    where: { examId_staffId: { examId, staffId } },
    create: { examId, staffId, assignedByStaffId: actorStaffId },
    update: {},
  });

  await recordAuditEvent(prisma, {
    actorStaffId,
    subjectType: "exam",
    subjectId: examId,
    action: "exam.staff_assigned",
    description: `Assigned ${staff.name} to ${exam.programme.title}'s examination`,
    ipAddress,
  });

  return created;
}

export async function unassignExamStaff(examId: string, staffId: string, actorStaffId: string, ipAddress: string | null) {
  const [exam, staff] = await Promise.all([
    prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { programme: { select: { title: true } } } }),
    prisma.staff.findUniqueOrThrow({ where: { id: staffId } }),
  ]);

  await prisma.examStaffAssignment.delete({ where: { examId_staffId: { examId, staffId } } });

  await recordAuditEvent(prisma, {
    actorStaffId,
    subjectType: "exam",
    subjectId: examId,
    action: "exam.staff_unassigned",
    description: `Removed ${staff.name} from ${exam.programme.title}'s examination`,
    ipAddress,
  });
}
