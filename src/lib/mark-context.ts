import type { PrismaClient, Prisma } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface MarkContext {
  candidateId: string;
  programmeId: string;
  programmeTitle: string;
  blindMarking: boolean;
}

/**
 * Resolves who a Mark belongs to and which programme's rules govern it
 * (blind marking) — a DRAFTING mark always has an enrolment; an
 * EXAMINATION_WRITTEN mark may not (Slice 06 rule 14, exam-only
 * registrations), and resolves instead via
 * examWrittenAnswer -> sitting -> registration.
 */
export async function resolveMarkContext(
  mark: { id: string; enrolmentId: string | null; examWrittenAnswerId: string | null },
  db: Db
): Promise<MarkContext> {
  if (mark.enrolmentId) {
    const enrolment = await db.enrolment.findUniqueOrThrow({
      where: { id: mark.enrolmentId },
      select: { candidateId: true, programme: { select: { id: true, title: true, blindMarking: true } } },
    });
    return { candidateId: enrolment.candidateId, programmeId: enrolment.programme.id, programmeTitle: enrolment.programme.title, blindMarking: enrolment.programme.blindMarking };
  }

  if (mark.examWrittenAnswerId) {
    const answer = await db.sittingAnswer.findUniqueOrThrow({
      where: { id: mark.examWrittenAnswerId },
      select: {
        sitting: { select: { registration: { select: { candidateId: true, exam: { select: { programme: { select: { id: true, title: true, blindMarking: true } } } } } } } },
      },
    });
    const { candidateId, exam } = answer.sitting.registration;
    return { candidateId, programmeId: exam.programme.id, programmeTitle: exam.programme.title, blindMarking: exam.programme.blindMarking };
  }

  throw new Error(`Mark ${mark.id} has neither an enrolment nor an exam written answer to resolve.`);
}
