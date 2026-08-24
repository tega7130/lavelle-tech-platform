import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { computePercent } from "@/lib/progress";
import type { ProgrammeEnrolmentRow, EnrolmentProgressStatus } from "@/lib/enrolment-reads";

/** "2026-02" — sorts and round-trips as a URL segment without ambiguity. */
export type MonthKey = string;

export function monthKeyOf(date: Date): MonthKey {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: MonthKey): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

interface EnrolmentWithStatus {
  enrolmentId: string;
  candidateId: string;
  candidateName: string;
  applicantNumber: string;
  candidateNumber: string | null;
  email: string;
  phone: string | null;
  enrolledAt: Date;
  completedAt: Date | null;
  lastActivityAt: Date | null;
  certificateIssued: boolean;
  status: EnrolmentProgressStatus;
  progressPercent: number;
  completedLectures: number;
  totalLectures: number;
  programmeId: string;
  programmeCode: string;
  programmeTitle: string;
  monthKey: MonthKey;
}

/**
 * Every ACTIVE/COMPLETED enrolment across every programme, each with its
 * derived not_started/in_progress/completed status — the same rule
 * getEnrolmentsByProgramme uses (src/lib/enrolment-reads.ts), just
 * computed for every programme in one pass instead of one at a time, so
 * grouping by month can cut across programmes. Enrolments with no
 * enrolledAt (still PENDING_PAYMENT) are excluded — matches
 * getEnrolmentsByProgramme's own ACTIVE/COMPLETED-only filter, which
 * guarantees enrolledAt is set.
 */
async function loadAllEnrolmentsWithStatus(): Promise<EnrolmentWithStatus[]> {
  const enrolments = await prisma.enrolment.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED"] } },
    include: {
      candidate: {
        select: { id: true, firstName: true, lastName: true, applicantNumber: true, candidateNumber: true, email: true, phone: true, phoneCountryCode: true },
      },
      programme: { select: { id: true, code: true, title: true } },
      certificates: { where: { status: "ACTIVE" }, select: { id: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });
  if (enrolments.length === 0) return [];

  const programmeIds = [...new Set(enrolments.map((e) => e.programmeId))];
  const enrolmentIds = enrolments.map((e) => e.id);

  const [modulesWithCounts, completedGroups, lastSeenGroups] = await Promise.all([
    prisma.module.findMany({
      where: { programmeId: { in: programmeIds } },
      select: { programmeId: true, _count: { select: { lectures: { where: { status: "PUBLISHED" } } } } },
    }),
    prisma.lectureProgress.groupBy({
      by: ["enrolmentId"],
      where: { enrolmentId: { in: enrolmentIds }, state: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.lectureProgress.groupBy({
      by: ["enrolmentId"],
      where: { enrolmentId: { in: enrolmentIds } },
      _max: { lastSeenAt: true },
    }),
  ]);

  const totalLecturesByProgramme = new Map<string, number>();
  for (const m of modulesWithCounts) {
    totalLecturesByProgramme.set(m.programmeId, (totalLecturesByProgramme.get(m.programmeId) ?? 0) + m._count.lectures);
  }
  const completedByEnrolment = new Map(completedGroups.map((g) => [g.enrolmentId, g._count._all]));
  const lastSeenByEnrolment = new Map(lastSeenGroups.map((g) => [g.enrolmentId, g._max.lastSeenAt]));

  return enrolments.map((e) => {
    const totalLectures = totalLecturesByProgramme.get(e.programmeId) ?? 0;
    const completedLectures = completedByEnrolment.get(e.id) ?? 0;
    const progressPercent = computePercent(completedLectures, totalLectures);
    const status: EnrolmentProgressStatus =
      progressPercent === 100 && totalLectures > 0 ? "completed" : completedLectures === 0 ? "not_started" : "in_progress";

    return {
      enrolmentId: e.id,
      candidateId: e.candidate.id,
      candidateName: `${e.candidate.firstName} ${e.candidate.lastName}`,
      applicantNumber: e.candidate.applicantNumber,
      candidateNumber: e.candidate.candidateNumber,
      email: e.candidate.email,
      phone: e.candidate.phone ? `${e.candidate.phoneCountryCode}${e.candidate.phone}` : null,
      enrolledAt: e.enrolledAt!,
      completedAt: e.completedAt,
      lastActivityAt: lastSeenByEnrolment.get(e.id) ?? null,
      certificateIssued: e.certificates.length > 0,
      status,
      progressPercent,
      completedLectures,
      totalLectures,
      programmeId: e.programme.id,
      programmeCode: e.programme.code,
      programmeTitle: e.programme.title,
      monthKey: monthKeyOf(e.enrolledAt!),
    };
  });
}

export interface MonthSummary {
  monthKey: MonthKey;
  label: string;
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
}

function summarise(rows: EnrolmentWithStatus[]): Omit<MonthSummary, "monthKey" | "label"> {
  return {
    total: rows.length,
    notStarted: rows.filter((r) => r.status === "not_started").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    completed: rows.filter((r) => r.status === "completed").length,
  };
}

/** One row per calendar month that has at least one enrolment, most recent first. */
export async function getEnrolmentsByMonth(): Promise<MonthSummary[]> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const rows = await loadAllEnrolmentsWithStatus();

  const byMonth = new Map<MonthKey, EnrolmentWithStatus[]>();
  for (const r of rows) {
    const bucket = byMonth.get(r.monthKey);
    if (bucket) bucket.push(r);
    else byMonth.set(r.monthKey, [r]);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([monthKey, monthRows]) => ({ monthKey, label: monthLabel(monthKey), ...summarise(monthRows) }));
}

export interface ProgrammeMonthBreakdown extends MonthSummary {
  programmeId: string;
  programmeCode: string;
  programmeTitle: string;
}

/** Within one month, how enrolments split across programmes — "Feb 2026 enrollees in Programme A", etc. */
export async function getMonthByProgrammeBreakdown(monthKey: MonthKey): Promise<{ month: MonthSummary; programmes: ProgrammeMonthBreakdown[] }> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const rows = (await loadAllEnrolmentsWithStatus()).filter((r) => r.monthKey === monthKey);

  const byProgramme = new Map<string, EnrolmentWithStatus[]>();
  for (const r of rows) {
    const bucket = byProgramme.get(r.programmeId);
    if (bucket) bucket.push(r);
    else byProgramme.set(r.programmeId, [r]);
  }

  const programmes = [...byProgramme.values()]
    .map((programmeRows) => ({
      programmeId: programmeRows[0]!.programmeId,
      programmeCode: programmeRows[0]!.programmeCode,
      programmeTitle: programmeRows[0]!.programmeTitle,
      monthKey,
      label: monthLabel(monthKey),
      ...summarise(programmeRows),
    }))
    .sort((a, b) => b.total - a.total);

  return { month: { monthKey, label: monthLabel(monthKey), ...summarise(rows) }, programmes };
}

/** The candidate list for one month + one programme — same row shape as getEnrolmentsByProgramme, so the admin enrolments table can render it unchanged. */
export async function getMonthProgrammeDetail(monthKey: MonthKey, programmeId: string): Promise<{ programmeTitle: string; rows: ProgrammeEnrolmentRow[] }> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const rows = (await loadAllEnrolmentsWithStatus()).filter((r) => r.monthKey === monthKey && r.programmeId === programmeId);

  return {
    programmeTitle: rows[0]?.programmeTitle ?? "",
    rows: rows.map((r) => ({
      enrolmentId: r.enrolmentId,
      candidateId: r.candidateId,
      candidateName: r.candidateName,
      applicantNumber: r.applicantNumber,
      candidateNumber: r.candidateNumber,
      email: r.email,
      phone: r.phone,
      status: r.status,
      enrolledAt: r.enrolledAt,
      completedAt: r.completedAt,
      lastActivityAt: r.lastActivityAt,
      progressPercent: r.progressPercent,
      completedLectures: r.completedLectures,
      totalLectures: r.totalLectures,
      certificateIssued: r.certificateIssued,
    })),
  };
}
