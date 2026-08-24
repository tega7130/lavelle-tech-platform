import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { computePercent } from "@/lib/progress";
import { getCandidateFunnel } from "@/lib/funnel-analytics";

export interface TopProgramme {
  id: string;
  code: string;
  title: string;
  enrolled: number;
}

export interface DashboardSummary {
  totalCandidates: number;
  activeEnrolments: number;
  certificatesIssued: number;
  overallCompletionRate: number | null; // "completed a programme" as a share of "enrolled", from the funnel
  topProgrammes: TopProgramme[];
}

/**
 * The analytics hub's summary — composes getCandidateFunnel (Feature 8)
 * for the completion-rate figure rather than recomputing it, plus two
 * cheap counts and a top-programmes ranking by enrolment count (the same
 * unfiltered _count.enrolments the Programmes list already shows, so
 * this page's numbers never disagree with that one).
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const [totalCandidates, certificatesIssued, funnel, topProgrammesRaw] = await Promise.all([
    prisma.candidate.count(),
    prisma.certificate.count({ where: { status: "ACTIVE" } }),
    getCandidateFunnel(),
    prisma.programme.findMany({
      where: { isExamOnlyShell: false },
      select: { id: true, code: true, title: true, _count: { select: { enrolments: true } } },
      orderBy: { enrolments: { _count: "desc" } },
      take: 5,
    }),
  ]);

  const enrolledStage = funnel.find((s) => s.key === "enrolled");
  const completedStage = funnel.find((s) => s.key === "completed");
  const overallCompletionRate =
    enrolledStage && completedStage && enrolledStage.count > 0 ? computePercent(completedStage.count, enrolledStage.count) : null;

  return {
    totalCandidates,
    activeEnrolments: enrolledStage?.count ?? 0,
    certificatesIssued,
    overallCompletionRate,
    topProgrammes: topProgrammesRaw
      .filter((p) => p._count.enrolments > 0)
      .map((p) => ({ id: p.id, code: p.code, title: p.title, enrolled: p._count.enrolments })),
  };
}
