import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { computePercent } from "@/lib/progress";

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  pctOfPrevious: number | null; // null for the first stage
  pctOfTotal: number;
}

/**
 * The candidate journey, stage by stage, each counted as a DISTINCT
 * candidate (not events) so the funnel only ever narrows or holds
 * steady, never widens from double-counting. "Paid" and "Enrolled" are
 * kept separate even though one confirmed payment usually produces an
 * ACTIVE enrolment in the same transaction — a payment can confirm with
 * cohort placement still pending (see enrolment-transaction's
 * "cohort_unavailable" path), so a candidate can sit in Paid without
 * yet being Enrolled. "Completed" reuses the same 100%-of-published-
 * lectures rule as getEnrolmentsByProgramme (src/lib/enrolment-reads.ts)
 * and the cohort analytics — never Enrolment.status, which this
 * codebase doesn't reliably flip on its own.
 */
export async function getCandidateFunnel(): Promise<FunnelStage[]> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const [registered, verified, paidCandidateIds, enrolledCandidateIds, startedCandidateIds, certifiedCandidateIds, completedCount] =
    await Promise.all([
      prisma.candidate.count(),
      prisma.candidate.count({ where: { emailVerifiedAt: { not: null } } }),
      prisma.payment.findMany({
        where: { status: "SUCCESS", purpose: "PROGRAMME_FEE", candidateId: { not: null } },
        select: { candidateId: true },
        distinct: ["candidateId"],
      }),
      prisma.enrolment.findMany({
        where: { status: { in: ["ACTIVE", "COMPLETED"] } },
        select: { candidateId: true },
        distinct: ["candidateId"],
      }),
      prisma.lectureProgress.findMany({
        select: { enrolment: { select: { candidateId: true } } },
        distinct: ["enrolmentId"],
      }),
      prisma.certificate.findMany({ select: { candidateId: true }, distinct: ["candidateId"] }),
      countCandidatesWithACompletedProgramme(),
    ]);

  const startedCandidates = new Set(startedCandidateIds.map((r) => r.enrolment.candidateId));

  const stages: { key: string; label: string; count: number }[] = [
    { key: "registered", label: "Registered", count: registered },
    { key: "verified", label: "Email verified", count: verified },
    { key: "paid", label: "Paid", count: paidCandidateIds.length },
    { key: "enrolled", label: "Enrolled", count: enrolledCandidateIds.length },
    { key: "started", label: "Started coursework", count: startedCandidates.size },
    { key: "completed", label: "Completed a programme", count: completedCount },
    { key: "certified", label: "Certificate issued", count: certifiedCandidateIds.length },
  ];

  return stages.map((s, i) => ({
    ...s,
    pctOfPrevious: i === 0 ? null : computePercent(s.count, stages[i - 1]!.count),
    pctOfTotal: computePercent(s.count, registered),
  }));
}

/** Distinct candidates with at least one enrolment at 100% of its programme's published lectures — same rule as getEnrolmentsByProgramme's "completed" status. */
async function countCandidatesWithACompletedProgramme(): Promise<number> {
  const enrolments = await prisma.enrolment.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { candidateId: true, programmeId: true, id: true },
  });
  if (enrolments.length === 0) return 0;

  const programmeIds = [...new Set(enrolments.map((e) => e.programmeId))];
  const enrolmentIds = enrolments.map((e) => e.id);

  const [modulesWithCounts, completedGroups] = await Promise.all([
    prisma.module.findMany({
      where: { programmeId: { in: programmeIds } },
      select: { programmeId: true, _count: { select: { lectures: { where: { status: "PUBLISHED" } } } } },
    }),
    prisma.lectureProgress.groupBy({
      by: ["enrolmentId"],
      where: { enrolmentId: { in: enrolmentIds }, state: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);

  const totalLecturesByProgramme = new Map<string, number>();
  for (const m of modulesWithCounts) {
    totalLecturesByProgramme.set(m.programmeId, (totalLecturesByProgramme.get(m.programmeId) ?? 0) + m._count.lectures);
  }
  const completedByEnrolment = new Map(completedGroups.map((g) => [g.enrolmentId, g._count._all]));

  const completedCandidates = new Set<string>();
  for (const e of enrolments) {
    const total = totalLecturesByProgramme.get(e.programmeId) ?? 0;
    const completed = completedByEnrolment.get(e.id) ?? 0;
    if (total > 0 && completed === total) completedCandidates.add(e.candidateId);
  }
  return completedCandidates.size;
}
