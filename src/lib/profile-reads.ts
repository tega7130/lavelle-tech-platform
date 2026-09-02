import "server-only";
import { prisma } from "@/lib/prisma";
import { intakeLabel, tierLabel } from "@/lib/format";

export async function getCandidateIdCard(candidateId: string) {
  return prisma.idCard.findFirst({ where: { candidateId, retiredAt: null } });
}

/**
 * The cohort line shown on the shell header pill and the ID card
 * ("Active — Specialist Cohort" / "September 2026 Intake") — the most
 * recent ACTIVE enrolment in the same tier as the candidate's current ID
 * card, falling back to the most recent ACTIVE enrolment of any tier if
 * the card predates it (e.g. a card reissued before a new enrolment).
 */
export async function getCandidateCohortStatus(candidateId: string, preferredTier?: string | null) {
  const [candidate, enrolments] = await Promise.all([
    prisma.candidate.findUniqueOrThrow({ where: { id: candidateId }, select: { accountStatus: true } }),
    prisma.enrolment.findMany({
      where: { candidateId, status: "ACTIVE" },
      include: { intake: true, programme: { select: { tier: true } } },
      orderBy: { enrolledAt: "desc" },
    }),
  ]);
  const enrolment = enrolments.find((e) => e.programme.tier === preferredTier) ?? enrolments[0];
  if (!enrolment) return null;

  const statusWord = candidate.accountStatus === "ACTIVE" ? "Active" : "Suspended";
  return {
    intakeLabel: enrolment.intake ? intakeLabel(enrolment.intake.month, enrolment.intake.year) : null,
    statusLine: `${statusWord} — ${tierLabel(enrolment.programme.tier)} Cohort`,
  };
}
