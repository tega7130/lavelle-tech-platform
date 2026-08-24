import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { computePercent } from "@/lib/progress";

const COMPLETION_THRESHOLD_PERCENT = 90;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** An upload's duration is probed server-side at upload (videoAsset.durationSeconds); a pasted link's is first-report-wins on Lecture itself. Exactly one is ever populated for a given lecture. */
function resolveDurationSeconds(lecture: { durationSeconds: number | null; videoAsset: { durationSeconds: number | null } | null }): number | null {
  return lecture.videoAsset?.durationSeconds ?? lecture.durationSeconds ?? null;
}

function watchedPercentOf(maxPositionSeconds: number, durationSeconds: number | null): number | null {
  if (durationSeconds == null || durationSeconds <= 0) return null;
  return computePercent(Math.min(maxPositionSeconds, durationSeconds), durationSeconds);
}

export interface LectureWatchStats {
  lectureId: string;
  lectureTitle: string;
  moduleTitle: string;
  weekNumber: number;
  durationSeconds: number | null;
  watcherCount: number; // distinct enrolments with any recorded watch progress
  averageWatchedPercent: number | null; // null when nobody has watched yet, or duration is still unknown
  completedCount: number; // watchers who reached the completion threshold
}

/** Per video lecture in one programme — the "per programme" half of watch-time analytics, mirrors getProgrammeAssessmentStats' per-module shape (src/lib/assessment-analytics.ts). */
export async function getVideoWatchStatsByProgramme(programmeId: string): Promise<LectureWatchStats[]> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const modules = await prisma.module.findMany({
    where: { programmeId },
    orderBy: { orderIndex: "asc" },
    select: {
      title: true,
      weekNumber: true,
      lectures: {
        where: { mediaKind: "VIDEO" },
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          durationSeconds: true,
          videoAsset: { select: { durationSeconds: true } },
          videoWatchProgress: { select: { maxPositionSeconds: true } },
        },
      },
    },
  });

  const stats: LectureWatchStats[] = [];
  for (const mod of modules) {
    for (const lec of mod.lectures) {
      const durationSeconds = resolveDurationSeconds(lec);
      const percents = lec.videoWatchProgress
        .map((w) => watchedPercentOf(w.maxPositionSeconds, durationSeconds))
        .filter((p): p is number => p != null);

      stats.push({
        lectureId: lec.id,
        lectureTitle: lec.title,
        moduleTitle: mod.title,
        weekNumber: mod.weekNumber,
        durationSeconds,
        watcherCount: lec.videoWatchProgress.length,
        averageWatchedPercent: average(percents),
        completedCount: percents.filter((p) => p >= COMPLETION_THRESHOLD_PERCENT).length,
      });
    }
  }
  return stats;
}

export interface CandidateLectureWatch {
  lectureId: string;
  lectureTitle: string;
  moduleTitle: string;
  weekNumber: number;
  programmeId: string;
  programmeCode: string;
  programmeTitle: string;
  maxPositionSeconds: number;
  durationSeconds: number | null;
  watchedPercent: number | null;
}

/** Every video this one candidate has ever made progress on, across every programme they're enrolled in — the "per student" half. */
export async function getVideoWatchStatsForCandidate(candidateId: string): Promise<CandidateLectureWatch[]> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const rows = await prisma.videoWatchProgress.findMany({
    where: { enrolment: { candidateId } },
    orderBy: { updatedAt: "desc" },
    select: {
      maxPositionSeconds: true,
      lecture: {
        select: {
          id: true,
          title: true,
          durationSeconds: true,
          videoAsset: { select: { durationSeconds: true } },
          module: {
            select: {
              title: true,
              weekNumber: true,
              programme: { select: { id: true, code: true, title: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((r) => {
    const durationSeconds = resolveDurationSeconds(r.lecture);
    return {
      lectureId: r.lecture.id,
      lectureTitle: r.lecture.title,
      moduleTitle: r.lecture.module.title,
      weekNumber: r.lecture.module.weekNumber,
      programmeId: r.lecture.module.programme.id,
      programmeCode: r.lecture.module.programme.code,
      programmeTitle: r.lecture.module.programme.title,
      maxPositionSeconds: r.maxPositionSeconds,
      durationSeconds,
      watchedPercent: watchedPercentOf(r.maxPositionSeconds, durationSeconds),
    };
  });
}
