import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { requireExamAccess } from "@/lib/exam-staff";
import { Permission, GradeBand } from "@/generated/prisma/client";
import { computePercent } from "@/lib/progress";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export interface ExamStats {
  totalRegistrations: number;
  started: number;
  submitted: number;
  released: number;
  forfeited: number;
  expired: number;
  passRate: number | null; // among released
  averageScore: number | null; // among released
  bandCounts: Record<GradeBand, number>;
}

/**
 * One exam's outcomes, scoped the same way listExamCandidates is
 * (requireExamAccess, not a blanket MANAGE_EXAMS check) — an exam-
 * assigned staff member should see the same stats they'd derive by hand
 * from the candidate roster. Pass rate and average score are computed
 * only over RELEASED sittings, since totalPercent/band are null until
 * then — a SUBMITTED-but-not-yet-marked sitting has no result to count.
 */
export async function getExamStats(examId: string): Promise<ExamStats> {
  await requireExamAccess(examId);

  const registrations = await prisma.examRegistration.findMany({
    where: { examId, cancelledAt: null },
    select: {
      sitting: { select: { state: true, totalPercent: true, outcome: true, band: true } },
    },
  });

  const sittings = registrations.map((r) => r.sitting).filter((s): s is NonNullable<typeof s> => !!s);
  const released = sittings.filter((s) => s.state === "RELEASED");
  const bandCounts: Record<GradeBand, number> = { DISTINCTION: 0, MERIT: 0, PASS: 0, REFER: 0 };
  for (const s of released) if (s.band) bandCounts[s.band]++;

  return {
    totalRegistrations: registrations.length,
    started: sittings.filter((s) => s.state !== "REGISTERED").length,
    submitted: sittings.filter((s) => ["SUBMITTED", "MARKED", "RELEASED"].includes(s.state)).length,
    released: released.length,
    forfeited: sittings.filter((s) => s.state === "FORFEITED").length,
    expired: sittings.filter((s) => s.state === "EXPIRED").length,
    passRate: released.length > 0 ? computePercent(released.filter((s) => s.outcome === "PASS").length, released.length) : null,
    averageScore: average(released.map((s) => s.totalPercent).filter((p): p is number => p != null)),
    bandCounts,
  };
}

export interface ModuleAssessmentStats {
  moduleId: string;
  moduleTitle: string;
  weekNumber: number;
  quiz: { attempts: number; passRate: number | null; averageScore: number | null } | null; // null = module has no quiz
  drafting: { marked: number; passRate: number | null; averageScore: number | null };
}

/**
 * Per-module quiz and drafting performance for one programme — the
 * course-side counterpart to getExamStats above. Quiz figures come from
 * completed QuizAttempt rows (submittedAt set); drafting figures come
 * from RETURNED Marks only, since scorePercent/band are null before
 * then. "Passed" for drafting is band !== REFER — the same signal
 * returnMark itself stores, not a re-derived threshold.
 */
export async function getProgrammeAssessmentStats(programmeId: string): Promise<ModuleAssessmentStats[]> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const modules = await prisma.module.findMany({
    where: { programmeId },
    orderBy: { orderIndex: "asc" },
    include: {
      quiz: { include: { attempts: { where: { submittedAt: { not: null } } } } },
      lectures: { include: { draftingSubmissions: { include: { mark: true } } } },
    },
  });

  return modules.map((mod) => {
    const quiz = mod.quiz
      ? {
          attempts: mod.quiz.attempts.length,
          passRate:
            mod.quiz.attempts.length > 0
              ? computePercent(mod.quiz.attempts.filter((a) => a.passed).length, mod.quiz.attempts.length)
              : null,
          averageScore: average(mod.quiz.attempts.map((a) => a.scorePercent).filter((p): p is number => p != null)),
        }
      : null;

    const returnedMarks = mod.lectures
      .flatMap((l) => l.draftingSubmissions.map((s) => s.mark))
      .filter((m): m is NonNullable<typeof m> => !!m && m.state === "RETURNED");

    return {
      moduleId: mod.id,
      moduleTitle: mod.title,
      weekNumber: mod.weekNumber,
      quiz,
      drafting: {
        marked: returnedMarks.length,
        passRate: returnedMarks.length > 0 ? computePercent(returnedMarks.filter((m) => m.band !== "REFER").length, returnedMarks.length) : null,
        averageScore: average(returnedMarks.map((m) => m.scorePercent).filter((p): p is number => p != null)),
      },
    };
  });
}
