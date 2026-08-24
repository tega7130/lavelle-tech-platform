import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { computePercent } from "@/lib/progress";

export type EnrolmentProgressStatus = "not_started" | "in_progress" | "completed";

export interface ProgrammeEnrolmentRow {
  enrolmentId: string;
  candidateId: string;
  candidateName: string;
  applicantNumber: string;
  candidateNumber: string | null;
  email: string;
  phone: string | null;
  status: EnrolmentProgressStatus;
  enrolledAt: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date | null;
  progressPercent: number;
  completedLectures: number;
  totalLectures: number;
  certificateIssued: boolean;
}

/**
 * Every actually-enrolled candidate (ACTIVE or COMPLETED — a
 * PENDING_PAYMENT/WITHDRAWN/REFUNDED row was never a real learner, or no
 * longer is one; that lifecycle belongs to the Finance ledger, not here)
 * for one programme, with the same not_started/in_progress/completed
 * derivation `listCandidateProgrammes` uses on the candidate's own
 * dashboard (src/lib/player-reads.ts) — 100% of published lectures
 * complete is what "completed" means, not Enrolment.status, since
 * nothing in this codebase reliably flips that to COMPLETED on its own.
 */
export async function getEnrolmentsByProgramme(programmeId: string): Promise<ProgrammeEnrolmentRow[]> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const totalLectures = await prisma.lecture.count({
    where: { status: "PUBLISHED", module: { programmeId } },
  });

  const enrolments = await prisma.enrolment.findMany({
    where: { programmeId, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: {
      candidate: {
        select: { id: true, firstName: true, lastName: true, applicantNumber: true, candidateNumber: true, email: true, phone: true, phoneCountryCode: true },
      },
      certificates: { where: { status: "ACTIVE" }, select: { id: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });
  if (enrolments.length === 0) return [];

  const enrolmentIds = enrolments.map((e) => e.id);

  const [completedGroups, lastSeenGroups] = await Promise.all([
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
  const completedByEnrolment = new Map(completedGroups.map((g) => [g.enrolmentId, g._count._all]));
  const lastSeenByEnrolment = new Map(lastSeenGroups.map((g) => [g.enrolmentId, g._max.lastSeenAt]));

  return enrolments.map((e) => {
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
      status,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      lastActivityAt: lastSeenByEnrolment.get(e.id) ?? null,
      progressPercent,
      completedLectures,
      totalLectures,
      certificateIssued: e.certificates.length > 0,
    };
  });
}

export interface ProgrammeEnrolmentStats {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
}

export function summariseEnrolments(rows: ProgrammeEnrolmentRow[]): ProgrammeEnrolmentStats {
  return {
    total: rows.length,
    notStarted: rows.filter((r) => r.status === "not_started").length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    completed: rows.filter((r) => r.status === "completed").length,
  };
}
