import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { checkExamEligibility } from "@/lib/exam-eligibility";
import { EnrolmentStatus } from "@/generated/prisma/client";
import type { PaperQuestion } from "@/lib/exam-draw";
import { NotYourSittingError, evaluateAttemptGate } from "@/lib/exam-sitting-actions";

async function findEnrolmentInfo(candidateId: string, programmeId: string) {
  const enrolment = await prisma.enrolment.findFirst({
    where: { candidateId, programmeId, status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] } },
    select: { id: true, completedAt: true },
  });
  return enrolment;
}

/** Programme exams with tier, code, intake, fee, next window, and the candidate's eligibility — never hiding an ineligible exam from the list. */
export async function listExamsForCandidate() {
  const candidate = await getCurrentCandidate();
  const exams = await prisma.exam.findMany({
    where: { status: "PUBLISHED" },
    include: {
      programme: { include: { category: true } },
      windows: { where: { closesAt: { gte: new Date() } }, orderBy: { opensAt: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    exams.map(async (e) => {
      const eligibility = await checkExamEligibility(candidate?.id ?? null, e.programme);
      const enrolment = candidate ? await findEnrolmentInfo(candidate.id, e.programmeId) : null;
      return {
        examId: e.id,
        programme: { title: e.programme.title, code: e.programme.code, tier: e.programme.tier },
        feeMinor: e.feeMinor,
        nextWindow: e.windows[0] ? { id: e.windows[0].id, opensAt: e.windows[0].opensAt } : null,
        eligibility,
        courseMet: !!enrolment,
      };
    })
  );
}

/** About, facts, windows — and the prerequisite verdict. Ineligible candidates see all of this; only payment is blocked elsewhere. */
export async function getExamDetail(examId: string) {
  const candidate = await getCurrentCandidate();
  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id: examId },
    include: {
      programme: { include: { category: true } },
      windows: { orderBy: { opensAt: "asc" } },
      requirements: { orderBy: { orderIndex: "asc" } },
    },
  });

  const eligibility = await checkExamEligibility(candidate?.id ?? null, exam.programme);
  const enrolment = candidate ? await findEnrolmentInfo(candidate.id, exam.programmeId) : null;

  // The MOST RECENT registration governs what's shown, not just a "live"
  // (uncancelled) one — once a candidate resits after a referral, the new
  // registration should take over display even though the old, concluded
  // one is still technically uncancelled.
  let existingRegistration = null;
  let canRegisterAgain = false;
  let attemptGateReason: string | null = null;
  if (candidate) {
    const registrations = await prisma.examRegistration.findMany({
      where: { candidateId: candidate.id, examId },
      orderBy: { attemptNumber: "desc" },
      include: { window: true, sitting: true, payment: true },
    });
    const reg = registrations[0] ?? null;
    existingRegistration = reg
      ? {
          id: reg.id,
          registeredAt: reg.registeredAt,
          windowId: reg.windowId,
          windowOpensAt: reg.window.opensAt,
          windowClosesAt: reg.window.closesAt,
          sittingId: reg.sitting?.id ?? null,
          sittingState: reg.sitting?.state ?? null,
          paymentStatus: reg.payment?.status ?? null,
          paymentReference: reg.payment?.internalReference ?? null,
          paymentConfirmedAt: reg.payment?.confirmedAt ?? null,
          hasEnrolment: !!reg.enrolmentId,
        }
      : null;

    const gate = evaluateAttemptGate(exam.attemptPolicy, registrations.length, reg?.sitting?.outcome);
    canRegisterAgain = gate.allowed;
    attemptGateReason = gate.reason;
  }

  return {
    exam: {
      id: exam.id,
      durationMinutes: exam.durationMinutes,
      passMarkPercent: exam.passMarkPercent,
      attemptPolicy: exam.attemptPolicy,
      feeMinor: exam.feeMinor,
      description: exam.description,
      instructions: exam.instructions,
      examFormat: exam.examFormat,
      examinationAreas: (exam.examinationAreas as string[] | null) ?? [],
      onPassing: (exam.onPassing as string[] | null) ?? [],
      requirements: exam.requirements.map((r) => ({ id: r.id, text: r.text, isMandatory: r.isMandatory })),
      enforceFullScreen: exam.enforceFullScreen,
      warnOnTabSwitch: exam.warnOnTabSwitch,
    },
    programme: {
      id: exam.programme.id,
      title: exam.programme.title,
      code: exam.programme.code,
      tier: exam.programme.tier,
      summary: exam.programme.summary,
      categoryName: exam.programme.category.name,
    },
    windows: exam.windows.map((w) => ({
      id: w.id,
      opensAt: w.opensAt,
      closesAt: w.closesAt,
      registrationDeadline: w.registrationDeadline,
      capacity: w.capacity,
    })),
    eligibility,
    enrolmentId: enrolment?.id ?? null,
    courseMet: !!enrolment,
    courseCompletedAt: enrolment?.completedAt ?? null,
    existingRegistration,
    canRegisterAgain,
    attemptGateReason,
  };
}

/**
 * The [code] route param is the programme code, matching the catalogue's
 * own convention — resolves it to the exam id getExamDetail actually
 * wants. Excludes DRAFT: a never-published exam must stay invisible to
 * candidates even if its programme code is guessed directly. PUBLISHED,
 * CLOSED, and ARCHIVED all resolve — a candidate who already registered
 * before the exam closed/archived still needs their registration/result
 * status to be reachable here.
 */
export async function getExamIdByProgrammeCode(code: string) {
  const exam = await prisma.exam.findFirst({ where: { programme: { code }, status: { not: "DRAFT" } }, select: { id: true } });
  return exam?.id ?? null;
}

/** Mirrors catalogue-reads.ts's getPaymentStatus, exam-fee flavoured — the checkout return page's authority (rule 6), never the redirect query string. */
export async function getExamPaymentStatus(internalReference: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return null;

  const payment = await prisma.payment.findUnique({
    where: { internalReference },
    select: {
      id: true,
      candidateId: true,
      status: true,
      confirmedAt: true,
      failedAt: true,
      failureReason: true,
      examRegistration: {
        select: {
          exam: { select: { programme: { select: { code: true, title: true } } } },
          window: { select: { opensAt: true } },
        },
      },
    },
  });
  if (!payment || payment.candidateId !== candidate.id) return null;
  return payment;
}

/**
 * Serves the sitting from its OWN paperSnapshot (rule 3) — never
 * re-queries live ExamQuestion rows, so a question edited mid-window
 * cannot change what a candidate already sitting sees.
 */
export async function getSittingForCandidate(sittingId: string, candidateId: string) {
  const sitting = await prisma.sitting.findUniqueOrThrow({
    where: { id: sittingId },
    include: { registration: { include: { exam: { include: { programme: true } } } }, answers: true },
  });
  if (sitting.registration.candidateId !== candidateId) throw new NotYourSittingError();

  const paper = (sitting.paperSnapshot as unknown as PaperQuestion[]) ?? [];
  const answerByQuestion = new Map(sitting.answers.map((a) => [a.questionId, a]));

  return {
    sitting: {
      id: sitting.id,
      state: sitting.state,
      startedAt: sitting.startedAt,
      expiresAt: sitting.expiresAt,
      submittedAt: sitting.submittedAt,
      totalPercent: sitting.totalPercent,
      outcome: sitting.outcome,
    },
    exam: {
      durationMinutes: sitting.registration.exam.durationMinutes,
      enforceFullScreen: sitting.registration.exam.enforceFullScreen,
      warnOnTabSwitch: sitting.registration.exam.warnOnTabSwitch,
      allowReviewBeforeSubmit: sitting.registration.exam.allowReviewBeforeSubmit,
    },
    programme: { title: sitting.registration.exam.programme.title, code: sitting.registration.exam.programme.code },
    paper,
    answers: Object.fromEntries(
      paper.map((q) => {
        const a = answerByQuestion.get(q.questionId);
        return [q.questionId, { selectedOptionId: a?.selectedOptionId ?? null, writtenAnswer: a?.writtenAnswer ?? null, flagged: a?.flagged ?? false }];
      })
    ),
  };
}

/** A released sitting's outcome, band, and — for every written answer — the examiner's returned feedback (rule 12/13, never before release). */
export async function getExamResultForCandidate(sittingId: string, candidateId: string) {
  const sitting = await prisma.sitting.findUniqueOrThrow({
    where: { id: sittingId },
    include: {
      registration: { include: { exam: { include: { programme: true } }, window: true } },
      answers: { include: { question: true, mark: true } },
    },
  });
  if (sitting.registration.candidateId !== candidateId) throw new NotYourSittingError();

  const writtenAnswers = sitting.answers
    .filter((a) => a.question.type === "WRITTEN")
    .map((a) => ({
      prompt: a.question.prompt,
      marks: a.question.marks,
      writtenAnswer: a.writtenAnswer,
      scorePercent: a.mark?.scorePercent ?? null,
      feedback: a.mark?.state === "RETURNED" ? a.mark.feedback : null,
    }));

  return {
    sitting: {
      id: sitting.id,
      state: sitting.state,
      objectivePercent: sitting.objectivePercent,
      writtenPercent: sitting.writtenPercent,
      totalPercent: sitting.totalPercent,
      outcome: sitting.outcome,
      band: sitting.band,
      submittedAt: sitting.submittedAt,
      releasedAt: sitting.releasedAt,
    },
    exam: { passMarkPercent: sitting.registration.exam.passMarkPercent },
    programme: { title: sitting.registration.exam.programme.title, code: sitting.registration.exam.programme.code },
    window: { opensAt: sitting.registration.window.opensAt },
    writtenAnswers,
  };
}
