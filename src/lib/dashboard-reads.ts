import "server-only";
import { prisma } from "@/lib/prisma";
import { EnrolmentStatus, LectureState } from "@/generated/prisma/client";
import { getProgrammeOverview } from "@/lib/player-reads";
import { listDeadlines } from "@/lib/player-reads";
import { getCredentialLadder } from "@/lib/credential-ladder";

/**
 * The next examination this candidate is registered for but hasn't yet
 * sat — a Sitting row only exists once startSitting() runs (Slice 06),
 * so "not yet sat" is exactly "no sitting row" here.
 */
export async function getUpcomingExamForCandidate(candidateId: string) {
  const now = new Date();
  const registration = await prisma.examRegistration.findFirst({
    where: {
      candidateId,
      cancelledAt: null,
      payment: { status: "SUCCESS" },
      window: { closesAt: { gte: now } },
      sitting: { is: null },
    },
    include: { exam: { include: { programme: true } }, window: true },
    orderBy: { window: { opensAt: "asc" } },
  });
  if (!registration) return null;

  const daysToGo = Math.max(0, Math.ceil((registration.window.opensAt.getTime() - now.getTime()) / 86_400_000));
  return {
    registrationId: registration.id,
    programmeTitle: registration.exam.programme.title,
    programmeCode: registration.exam.programme.code,
    opensAt: registration.window.opensAt,
    durationMinutes: registration.exam.durationMinutes,
    daysToGo,
  };
}

export async function getDashboardSummary(candidateId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { candidateId, status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] } },
    include: { programme: true },
    orderBy: { enrolledAt: "desc" },
  });
  const primary = enrolments.find((e) => e.status === "ACTIVE") ?? enrolments[0] ?? null;

  let primaryProgramme: {
    enrolmentId: string;
    programmeTitle: string;
    programmeCode: string;
    completedLectures: number;
    totalLectures: number;
    percent: number;
    upNext: { moduleTitle: string; lectureTitle: string } | null;
  } | null = null;

  if (primary) {
    const overview = await getProgrammeOverview(candidateId, primary.id);
    let completed = 0;
    let total = 0;
    for (const mod of overview.modules) {
      total += mod.lectures.length;
      completed += mod.lectures.filter((l) => l.state === LectureState.COMPLETED).length;
    }
    primaryProgramme = {
      enrolmentId: primary.id,
      programmeTitle: primary.programme.title,
      programmeCode: primary.programme.code,
      completedLectures: completed,
      totalLectures: total,
      percent: overview.programmePercent,
      upNext: overview.upNext ? { moduleTitle: overview.upNext.moduleTitle, lectureTitle: overview.upNext.lectureTitle } : null,
    };
  }

  const [{ ladder, latestCertificate }, allDeadlines, upcomingExam] = await Promise.all([
    getCredentialLadder(candidateId),
    listDeadlines(candidateId),
    getUpcomingExamForCandidate(candidateId),
  ]);

  const deadlines = allDeadlines.filter((d) => d.state !== "MET" && d.state !== "WAIVED").slice(0, 3);

  return { primaryProgramme, ladder, latestCertificate, deadlines, upcomingExam };
}
