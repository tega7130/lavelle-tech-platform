import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { average, resolveGradeBand } from "@/lib/grading";
import { formatNaira, intakeLabel } from "@/lib/format";

const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };

interface TimelineEntry {
  id: string;
  occurredAt: Date;
  description: string;
}

/**
 * The Candidates-list quick-view modal — header stats plus a real
 * activity timeline. AuditEvent alone can't build this: enrolment and
 * payment events are logged under their OWN subjectType (not
 * "candidate"), and routine submissions/quiz attempts were never audit
 * events at all (too high-frequency to be worth one). So this reads the
 * source tables directly and synthesizes the timeline from them, the
 * same data every other candidate-facing and admin screen already reads.
 */
export async function getCandidateQuickView(candidateId: string) {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  const enrolments = await prisma.enrolment.findMany({
    where: { candidateId, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { programme: true, intake: true },
    orderBy: { enrolledAt: "desc" },
  });
  const enrolmentIds = enrolments.map((e) => e.id);
  const primary = enrolments[0] ?? null;

  const [completedByEnrolment, lecturesByProgramme, drafting, quizzes, payments, idCards, certificates] = await Promise.all([
    enrolmentIds.length
      ? prisma.lectureProgress.groupBy({ by: ["enrolmentId"], where: { enrolmentId: { in: enrolmentIds }, state: "COMPLETED" }, _count: true })
      : [],
    enrolments.length
      ? prisma.module.findMany({ where: { programmeId: { in: enrolments.map((e) => e.programmeId) } }, select: { programmeId: true, _count: { select: { lectures: true } } } })
      : [],
    enrolmentIds.length
      ? prisma.draftingSubmission.findMany({
          where: { enrolmentId: { in: enrolmentIds }, submittedAt: { not: null } },
          include: { lecture: { select: { title: true, module: { select: { title: true } } } }, mark: { select: { scorePercent: true, band: true, state: true } } },
          orderBy: { submittedAt: "desc" },
        })
      : [],
    enrolmentIds.length
      ? prisma.quizAttempt.findMany({
          where: { enrolmentId: { in: enrolmentIds }, submittedAt: { not: null } },
          include: { quiz: { include: { module: { select: { title: true } } } } },
          orderBy: { submittedAt: "desc" },
        })
      : [],
    prisma.payment.findMany({ where: { candidateId, status: "SUCCESS" }, orderBy: { confirmedAt: "desc" } }),
    prisma.idCard.findMany({ where: { candidateId }, orderBy: { issuedAt: "desc" } }),
    prisma.certificate.findMany({ where: { candidateId }, orderBy: { issuedAt: "desc" } }),
  ]);

  const completedMap = new Map(completedByEnrolment.map((r) => [r.enrolmentId, r._count]));
  const totalByProgramme = new Map<string, number>();
  for (const m of lecturesByProgramme) totalByProgramme.set(m.programmeId, (totalByProgramme.get(m.programmeId) ?? 0) + m._count.lectures);

  const primaryTotal = primary ? (totalByProgramme.get(primary.programmeId) ?? 0) : 0;
  const primaryCompleted = primary ? (completedMap.get(primary.id) ?? 0) : 0;
  const percent = primary && primaryTotal > 0 ? Math.round((primaryCompleted / primaryTotal) * 100) : null;

  const scores = [
    ...drafting.filter((d) => d.mark?.state === "RETURNED" && d.mark.scorePercent != null).map((d) => d.mark!.scorePercent!),
    ...quizzes.filter((q) => q.scorePercent != null).map((q) => q.scorePercent!),
  ];
  const avgScore = average(scores);
  const avgBand = avgScore != null ? await resolveGradeBand(avgScore, new Date(), prisma).catch(() => null) : null;
  const averageGradeLabel = avgBand ? BAND_LABEL[avgBand] : null;

  const timeline: TimelineEntry[] = [];
  for (const e of enrolments) {
    if (e.enrolledAt) timeline.push({ id: `enrol-${e.id}`, occurredAt: e.enrolledAt, description: `Enrolled in ${e.programme.title}` });
  }
  for (const p of payments) {
    if (p.confirmedAt) timeline.push({ id: `pay-${p.id}`, occurredAt: p.confirmedAt, description: `Payment received ${formatNaira(p.amountMinor)} · ${p.provider}` });
  }
  for (const c of idCards) {
    timeline.push({
      id: `card-${c.id}`,
      occurredAt: c.issuedAt,
      description: c.reissuedFromId ? "Candidate ID card reissued" : "Candidate ID card issued automatically on payment confirmation",
    });
  }
  for (const d of drafting) {
    if (d.submittedAt) {
      timeline.push({
        id: `draft-${d.id}`,
        occurredAt: d.submittedAt,
        description: `Submitted ${d.lecture.module.title}, ${d.lecture.title} drafting exercise`,
      });
    }
  }
  for (const q of quizzes) {
    if (q.submittedAt && q.scorePercent != null) {
      const band = await resolveGradeBand(q.scorePercent, q.submittedAt, prisma).catch(() => null);
      timeline.push({
        id: `quiz-${q.id}`,
        occurredAt: q.submittedAt,
        description: `${q.quiz.module.title} quiz — ${q.scorePercent}%${band ? ` (${BAND_LABEL[band]})` : ""}`,
      });
    }
  }
  for (const c of certificates) {
    timeline.push({ id: `cert-${c.id}`, occurredAt: c.issuedAt, description: `Certificate issued — ${c.programmeTitle} (${BAND_LABEL[c.band]})` });
  }

  timeline.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return {
    candidate: {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      applicantNumber: candidate.applicantNumber,
      candidateNumber: candidate.candidateNumber,
      accountStatus: candidate.accountStatus,
    },
    primaryEnrolment: primary
      ? {
          id: primary.id,
          programmeTitle: primary.programme.title,
          programmeId: primary.programmeId,
          intakeId: primary.intakeId,
          intakeLabel: primary.intake ? intakeLabel(primary.intake.month, primary.intake.year) : null,
        }
      : null,
    stats: {
      percent,
      averageGradeLabel,
      completedLectures: primaryCompleted,
      totalLectures: primaryTotal,
    },
    idCard: idCards.find((c) => !c.retiredAt) ?? null,
    timeline: timeline.slice(0, 20),
  };
}
