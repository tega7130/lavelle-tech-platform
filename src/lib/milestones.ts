import "server-only";
import { prisma } from "@/lib/prisma";
import { getCandidateCredentials } from "@/lib/certificate-candidate-reads";

export type MilestoneKey =
  | "FIRST_CREDENTIAL"
  | "DISTINCTION_HOLDER"
  | "PERFECT_MODULE"
  | "NEVER_LATE"
  | "TWO_PRACTICE_AREAS"
  | "ADVANCED_PRACTITIONER";

export interface Milestone {
  key: MilestoneKey;
  title: string;
  description: string;
  earned: boolean;
  /** 0-1, only meaningful when not yet earned — drives the progress bar. */
  progress: number | null;
}

/**
 * Recorded on the candidate's record and travel with their practice
 * record — they never affect a grade or a certificate's standing, purely
 * a record of consistent practice. Six fixed milestones, each computed
 * fresh from the same tables the rest of the candidate record reads from
 * (no separate ledger to keep in sync).
 */
export async function getMilestones(candidateId: string): Promise<Milestone[]> {
  const [credentials, enrolments] = await Promise.all([
    getCandidateCredentials(candidateId),
    prisma.enrolment.findMany({
      where: { candidateId, status: { in: ["ACTIVE", "COMPLETED"] } },
      select: { id: true },
    }),
  ]);
  const enrolmentIds = enrolments.map((e) => e.id);
  const liveCertificates = credentials.certificates.filter((c) => c.status === "ACTIVE");

  const [perfectQuiz, draftingDeadlines, certifiedCategories] = await Promise.all([
    enrolmentIds.length
      ? prisma.quizAttempt.findFirst({
          where: { enrolmentId: { in: enrolmentIds }, scorePercent: 100 },
          include: { quiz: { include: { module: true } } },
          orderBy: { submittedAt: "asc" },
        })
      : null,
    enrolmentIds.length
      ? prisma.deadline.findMany({
          where: { enrolmentId: { in: enrolmentIds }, kind: "DRAFTING_DUE", dueAt: { lte: new Date() } },
          select: { dueAt: true, metAt: true },
        })
      : [],
    liveCertificates.some((c) => c.tier === "SPECIALIST")
      ? prisma.programme.findMany({
          where: { code: { in: liveCertificates.filter((c) => c.tier === "SPECIALIST").map((c) => c.programmeCode) } },
          select: { categoryId: true },
        })
      : [],
  ]);

  const assignedSoFar = draftingDeadlines.length;
  const onTime = draftingDeadlines.filter((d) => d.metAt && d.metAt <= d.dueAt).length;
  const late = assignedSoFar - onTime;

  const distinct = new Set(certifiedCategories.map((c) => c.categoryId));

  return [
    {
      key: "FIRST_CREDENTIAL",
      title: "First credential",
      description: "Awarded on your first Lavelle certificate.",
      earned: liveCertificates.length > 0,
      progress: liveCertificates.length > 0 ? 1 : 0,
    },
    {
      key: "DISTINCTION_HOLDER",
      title: "Distinction holder",
      description: "A certificate awarded at 70% or above.",
      earned: liveCertificates.some((c) => c.band === "DISTINCTION"),
      progress: liveCertificates.some((c) => c.band === "DISTINCTION") ? 1 : 0,
    },
    {
      key: "PERFECT_MODULE",
      title: "Perfect module",
      description: perfectQuiz
        ? `Full marks on a module quiz — ${perfectQuiz.quiz.module.title}.`
        : "Full marks on a module quiz.",
      earned: !!perfectQuiz,
      progress: perfectQuiz ? 1 : 0,
    },
    {
      key: "NEVER_LATE",
      title: "Never late",
      description:
        assignedSoFar > 0
          ? `${onTime} of ${assignedSoFar} drafting exercises submitted before deadline.`
          : "Submit drafting exercises before their deadline.",
      earned: assignedSoFar > 0 && late === 0,
      progress: assignedSoFar > 0 ? onTime / assignedSoFar : 0,
    },
    {
      key: "TWO_PRACTICE_AREAS",
      title: "Two practice areas",
      description: `Hold Specialist certificates in two areas. ${Math.min(distinct.size, 2)} of 2.`,
      earned: distinct.size >= 2,
      progress: Math.min(distinct.size, 2) / 2,
    },
    {
      key: "ADVANCED_PRACTITIONER",
      title: "Advanced Practitioner",
      description: "Reach the third tier of the ladder.",
      earned: liveCertificates.some((c) => c.tier === "ADVANCED_PRACTITIONER"),
      progress: null,
    },
  ];
}
