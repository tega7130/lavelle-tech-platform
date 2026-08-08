import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface EligibilityVerdict {
  eligible: boolean;
  prerequisiteRequired: boolean; // true only for ADVANCED_PRACTITIONER
  prerequisiteMet: boolean;
  prerequisiteProgrammeTitle: string | null; // the specialist programme that satisfies it, if the candidate holds one
}

/**
 * Foundation and Specialist are open (rule/Eligibility table). Advanced
 * Practitioner requires a COMPLETED enrolment in a Specialist-tier
 * programme in the SAME specialization — "specialization" is the
 * programme's category (e.g. "Energy & Natural Resources"), the only
 * grouping concept the schema has for it. Evaluated server-side on both
 * the detail view and registerForExam (rule 6/10) — never hidden from
 * an ineligible candidate, only the payment path is blocked by callers.
 */
export async function checkExamEligibility(
  candidateId: string | null,
  programme: { tier: string; categoryId: string },
  db: Db = prisma
): Promise<EligibilityVerdict> {
  if (programme.tier !== "ADVANCED_PRACTITIONER") {
    return { eligible: true, prerequisiteRequired: false, prerequisiteMet: true, prerequisiteProgrammeTitle: null };
  }
  if (!candidateId) {
    return { eligible: false, prerequisiteRequired: true, prerequisiteMet: false, prerequisiteProgrammeTitle: null };
  }

  const completed = await db.enrolment.findFirst({
    where: {
      candidateId,
      status: "COMPLETED",
      programme: { categoryId: programme.categoryId, tier: "SPECIALIST" },
    },
    include: { programme: { select: { title: true } } },
  });

  return {
    eligible: !!completed,
    prerequisiteRequired: true,
    prerequisiteMet: !!completed,
    prerequisiteProgrammeTitle: completed?.programme.title ?? null,
  };
}
