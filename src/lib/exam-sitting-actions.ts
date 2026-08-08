import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { generateInternalReference, createProviderCheckout } from "@/lib/payment-provider";
import { checkExamEligibility } from "@/lib/exam-eligibility";
import { drawPaper, type DrawableQuestion, type PaperQuestion } from "@/lib/exam-draw";
import { computeExpiresAt, isSittingExpired } from "@/lib/exam-clock";
import { resolveGradeBand } from "@/lib/grading";
import { recomputeProgrammeResult } from "@/lib/programme-result";
import { issueCertificate } from "@/lib/certificate-actions";
import { EnrolmentStatus, MarkState, MarkableKind, type Prisma } from "@/generated/prisma/client";

// No "server-only" / staff-auth / candidate-session import here,
// deliberately — same discipline as enrolment-transaction.ts. candidateId
// and staffId are always passed in by the caller, so this file stays
// importable from Vitest and never breaks under the plain-Node resolver.

export class IneligibleError extends Error {
  constructor() {
    super("You are not yet eligible to register for this examination.");
    this.name = "IneligibleError";
  }
}
export class RegistrationClosedError extends Error {
  constructor(message = "Registration for this window has closed.") {
    super(message);
    this.name = "RegistrationClosedError";
  }
}
export class SittingExpiredError extends Error {
  constructor() {
    super("Time has expired for this sitting.");
    this.name = "SittingExpiredError";
  }
}
export class NotYourSittingError extends Error {
  constructor() {
    super("This does not belong to you.");
    this.name = "NotYourSittingError";
  }
}

/**
 * Eligibility check, then creates the registration and the
 * EXAMINATION_FEE payment (rule 5/6/10) — a separate transaction from
 * the programme fee, same Payment table, purpose = EXAMINATION_FEE.
 * enrolmentId is set only where the candidate holds an active/completed
 * enrolment in the exam's programme (rule 14 — the pathway distinction).
 */
export async function registerForExam(examId: string, windowId: string, candidateId: string, candidateEmail: string) {
  const exam = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { programme: true } });
  if (exam.status !== "PUBLISHED") throw new Error("This examination is not open for registration.");

  const eligibility = await checkExamEligibility(candidateId, exam.programme);
  if (!eligibility.eligible) throw new IneligibleError();

  const window = await prisma.examWindow.findUniqueOrThrow({ where: { id: windowId } });
  if (window.examId !== examId) throw new Error("That window does not belong to this examination.");
  const now = new Date();
  if (now > window.registrationDeadline) throw new RegistrationClosedError();

  if (window.capacity != null) {
    const taken = await prisma.examRegistration.count({ where: { windowId, cancelledAt: null } });
    if (taken >= window.capacity) throw new RegistrationClosedError("This window is full.");
  }

  const existingLive = await prisma.examRegistration.findFirst({ where: { candidateId, windowId, cancelledAt: null } });
  if (existingLive) throw new Error("You are already registered for this window.");

  const enrolment = await prisma.enrolment.findFirst({
    where: { candidateId, programmeId: exam.programmeId, status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] } },
  });
  const priorAttempts = await prisma.examRegistration.count({ where: { candidateId, examId } });

  const { registration, payment } = await prisma.$transaction(async (tx) => {
    const internalReference = generateInternalReference();
    const payment = await tx.payment.create({
      data: {
        candidateId,
        purpose: "EXAMINATION_FEE",
        amountMinor: exam.feeMinor,
        provider: "paystack",
        internalReference,
        status: "PENDING",
      },
    });
    const registration = await tx.examRegistration.create({
      data: {
        candidateId,
        examId,
        windowId,
        enrolmentId: enrolment?.id ?? null,
        paymentId: payment.id,
        attemptNumber: priorAttempts + 1,
        registeredAt: now,
      },
    });
    return { registration, payment };
  });

  const checkout = createProviderCheckout({
    provider: payment.provider,
    internalReference: payment.internalReference,
    amountMinor: payment.amountMinor,
    candidateEmail,
  });

  return { registration, internalReference: payment.internalReference, checkoutUrl: checkout.checkoutUrl };
}

/**
 * Draws the paper, snapshots it, sets startedAt/expiresAt — idempotent
 * (rule 3). A concurrent double-call races on the Sitting's unique
 * registrationId; the loser's create() throws P2002 and is treated as
 * "already started," returning the winner's row rather than erroring.
 */
export async function startSitting(registrationId: string, candidateId: string) {
  const registration = await prisma.examRegistration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { exam: true, window: true, sitting: true },
  });
  if (registration.candidateId !== candidateId) throw new NotYourSittingError();
  if (registration.cancelledAt) throw new Error("This registration has been cancelled.");
  if (registration.sitting) return registration.sitting;

  const now = new Date();
  if (now < registration.window.opensAt) throw new Error("This examination window has not opened yet.");
  if (now > registration.window.closesAt) throw new Error("This examination window has closed.");

  const modules = await prisma.module.findMany({ where: { programmeId: registration.exam.programmeId } });
  const questions = await prisma.examQuestion.findMany({
    where: { examId: registration.examId },
    include: { options: { orderBy: { orderIndex: "asc" } } },
  });

  const paper: PaperQuestion[] = drawPaper(
    modules.map((m) => ({ moduleId: m.id, draw: m.examQuestionDraw })),
    questions as unknown as DrawableQuestion[],
    { shuffleQuestions: registration.exam.shuffleQuestions, shuffleOptions: registration.exam.shuffleOptions }
  );

  const expiresAt = computeExpiresAt(now, registration.exam.durationMinutes);

  try {
    return await prisma.sitting.create({
      data: { registrationId, state: "IN_PROGRESS", startedAt: now, expiresAt, paperSnapshot: paper as unknown as Prisma.InputJsonValue },
    });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return prisma.sitting.findUniqueOrThrow({ where: { registrationId } });
    }
    throw e;
  }
}

/** Best-effort conduct log (rule: enforceFullScreen/warnOnTabSwitch) — never blocks the candidate's own flow, just a record for staff review. */
export async function logProctoringEvent(sittingId: string, candidateId: string, kind: string, detail?: Record<string, unknown>) {
  const sitting = await prisma.sitting.findUniqueOrThrow({ where: { id: sittingId }, include: { registration: true } });
  if (sitting.registration.candidateId !== candidateId) throw new NotYourSittingError();
  return prisma.proctoringEvent.create({
    data: { sittingId, kind, occurredAt: new Date(), detail: detail as unknown as Prisma.InputJsonValue },
  });
}

export interface SaveAnswerInput {
  questionId: string;
  selectedOptionId?: string | null;
  writtenAnswer?: string | null;
  flagged?: boolean;
}

/** Autosave — rejects after expiresAt (rule 4/7/5), regardless of what the client's clock claims. */
export async function saveSittingAnswer(sittingId: string, candidateId: string, data: SaveAnswerInput) {
  const sitting = await prisma.sitting.findUniqueOrThrow({ where: { id: sittingId }, include: { registration: true } });
  if (sitting.registration.candidateId !== candidateId) throw new NotYourSittingError();
  if (sitting.state !== "IN_PROGRESS") throw new Error("This sitting is no longer in progress.");
  if (isSittingExpired(sitting.expiresAt)) throw new SittingExpiredError();

  return prisma.sittingAnswer.upsert({
    where: { sittingId_questionId: { sittingId, questionId: data.questionId } },
    create: {
      sittingId,
      questionId: data.questionId,
      selectedOptionId: data.selectedOptionId ?? null,
      writtenAnswer: data.writtenAnswer ?? null,
      flagged: data.flagged ?? false,
    },
    update: {
      ...(data.selectedOptionId !== undefined ? { selectedOptionId: data.selectedOptionId } : {}),
      ...(data.writtenAnswer !== undefined ? { writtenAnswer: data.writtenAnswer } : {}),
      ...(data.flagged !== undefined ? { flagged: data.flagged } : {}),
      answeredAt: new Date(),
    },
  });
}

/**
 * Marks objectives from paperSnapshot's real answer key (never trusts
 * the client), queues written answers into the Slice 05 marking queue as
 * MarkableKind.EXAMINATION_WRITTEN (rule 11) — not a second marking
 * system. Rejected past expiresAt: a late submission is the cron sweep's
 * territory (expireOverdueSittings), which marks EXPIRED, not SUBMITTED.
 */
export async function submitSitting(sittingId: string, candidateId: string) {
  return prisma.$transaction(async (tx) => {
    const sitting = await tx.sitting.findUniqueOrThrow({
      where: { id: sittingId },
      include: { registration: true, answers: true },
    });
    if (sitting.registration.candidateId !== candidateId) throw new NotYourSittingError();
    if (sitting.state !== "IN_PROGRESS") throw new Error("This sitting cannot be submitted.");
    if (isSittingExpired(sitting.expiresAt)) throw new SittingExpiredError();

    const paper = (sitting.paperSnapshot as unknown as PaperQuestion[]) ?? [];
    const objective = paper.filter((q) => q.type === "OBJECTIVE");
    const written = paper.filter((q) => q.type === "WRITTEN");

    const realQuestions = await tx.examQuestion.findMany({
      where: { id: { in: paper.map((q) => q.questionId) } },
      include: { options: true },
    });
    const realById = new Map(realQuestions.map((q) => [q.id, q]));
    const answerByQuestion = new Map(sitting.answers.map((a) => [a.questionId, a]));

    let earnedMarks = 0;
    let possibleMarks = 0;
    for (const q of objective) {
      const real = realById.get(q.questionId);
      if (!real) continue;
      possibleMarks += real.marks;
      const answer = answerByQuestion.get(q.questionId);
      const correctOption = real.options.find((o) => o.isCorrect);
      if (answer?.selectedOptionId && correctOption && answer.selectedOptionId === correctOption.id) {
        earnedMarks += real.marks;
      }
    }
    const objectivePercent = possibleMarks > 0 ? Math.round((earnedMarks / possibleMarks) * 100) : null;

    const now = new Date();
    const updated = await tx.sitting.update({
      where: { id: sittingId },
      data: { state: "SUBMITTED", submittedAt: now, objectivePercent },
    });

    for (const q of written) {
      const answer = answerByQuestion.get(q.questionId);
      if (!answer) continue; // unanswered — nothing to queue for marking
      const existingMark = await tx.mark.findUnique({ where: { examWrittenAnswerId: answer.id } });
      if (!existingMark) {
        await tx.mark.create({
          data: {
            enrolmentId: sitting.registration.enrolmentId,
            kind: MarkableKind.EXAMINATION_WRITTEN,
            examWrittenAnswerId: answer.id,
            state: MarkState.AWAITING,
          },
        });
      }
    }

    return updated;
  });
}

/**
 * The Quit path — explicit and irreversible (rule 6/8). Answers are not
 * marked, no result is recorded, and the registration is closed. The
 * candidate may register afresh for a later window; the fee is payable
 * again (a fresh registerForExam call, not a reactivation of this one).
 */
export async function forfeitSitting(sittingId: string, candidateId: string) {
  return prisma.$transaction(async (tx) => {
    const sitting = await tx.sitting.findUniqueOrThrow({ where: { id: sittingId }, include: { registration: true } });
    if (sitting.registration.candidateId !== candidateId) throw new NotYourSittingError();
    if (sitting.state !== "IN_PROGRESS") throw new Error("This sitting cannot be forfeited.");

    const now = new Date();
    const updated = await tx.sitting.update({ where: { id: sittingId }, data: { state: "FORFEITED", forfeitedAt: now } });
    await tx.examRegistration.update({ where: { id: sitting.registrationId }, data: { cancelledAt: now } });

    await recordAuditEvent(tx, {
      actorStaffId: null,
      subjectType: "sitting",
      subjectId: sittingId,
      action: "sitting.forfeited",
      description: "Candidate ended the sitting before submitting — forfeited",
      ipAddress: null,
    });

    return updated;
  });
}

/**
 * The actual expiry finalizer, shared by the cron sweep and the
 * client-triggered single-sitting check below — both must produce
 * identical results, so there is exactly one implementation. Re-reads
 * the sitting inside its own transaction and no-ops if it already moved
 * (raced with a submit/forfeit, or a previous call already finalized it).
 */
async function expireOneSitting(sittingId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.sitting.findUnique({ where: { id: sittingId }, include: { registration: true, answers: true } });
    if (!fresh || fresh.state !== "IN_PROGRESS" || !isSittingExpired(fresh.expiresAt)) return false;

    const paper = (fresh.paperSnapshot as unknown as PaperQuestion[]) ?? [];
    const objective = paper.filter((q) => q.type === "OBJECTIVE");
    const written = paper.filter((q) => q.type === "WRITTEN");
    const realQuestions = await tx.examQuestion.findMany({ where: { id: { in: paper.map((q) => q.questionId) } }, include: { options: true } });
    const realById = new Map(realQuestions.map((q) => [q.id, q]));
    const answerByQuestion = new Map(fresh.answers.map((a) => [a.questionId, a]));

    let earnedMarks = 0;
    let possibleMarks = 0;
    for (const q of objective) {
      const real = realById.get(q.questionId);
      if (!real) continue;
      possibleMarks += real.marks;
      const answer = answerByQuestion.get(q.questionId);
      const correctOption = real.options.find((o) => o.isCorrect);
      if (answer?.selectedOptionId && correctOption && answer.selectedOptionId === correctOption.id) earnedMarks += real.marks;
    }
    const objectivePercent = possibleMarks > 0 ? Math.round((earnedMarks / possibleMarks) * 100) : null;

    await tx.sitting.update({ where: { id: sittingId }, data: { state: "EXPIRED", objectivePercent } });

    for (const q of written) {
      const answer = answerByQuestion.get(q.questionId);
      if (!answer) continue;
      const existingMark = await tx.mark.findUnique({ where: { examWrittenAnswerId: answer.id } });
      if (!existingMark) {
        await tx.mark.create({
          data: { enrolmentId: fresh.registration.enrolmentId, kind: MarkableKind.EXAMINATION_WRITTEN, examWrittenAnswerId: answer.id, state: MarkState.AWAITING },
        });
      }
    }

    await recordAuditEvent(tx, {
      actorStaffId: null,
      subjectType: "sitting",
      subjectId: sittingId,
      action: "sitting.expired",
      description: "Sitting expired — marked on what was answered",
      ipAddress: null,
    });
    return true;
  });
}

/**
 * Sweeps sittings past expiresAt that were never submitted or forfeited
 * (rule: expiry is not forfeiture — an expired sitting IS marked on
 * what was answered, mirroring submitSitting's own marking logic). The
 * backstop for a tab that was closed or lost connection before expiry.
 */
export async function expireOverdueSittings(now: Date = new Date()) {
  const overdue = await prisma.sitting.findMany({ where: { state: "IN_PROGRESS", expiresAt: { lt: now } }, select: { id: true } });
  let expiredCount = 0;
  for (const sitting of overdue) {
    if (await expireOneSitting(sitting.id)) expiredCount++;
  }
  return expiredCount;
}

/**
 * The client calls this the moment its own countdown reaches zero, so a
 * candidate whose tab is still open sees their sitting finalized
 * immediately rather than waiting for the next cron tick. No-ops (and is
 * safe to call) if the sitting isn't actually overdue yet — the server
 * clock, not the client's, is what isSittingExpired checks.
 */
export async function expireSittingIfOverdue(sittingId: string, candidateId: string) {
  const sitting = await prisma.sitting.findUniqueOrThrow({ where: { id: sittingId }, include: { registration: true } });
  if (sitting.registration.candidateId !== candidateId) throw new NotYourSittingError();
  const finalized = await expireOneSitting(sittingId);
  const fresh = await prisma.sitting.findUniqueOrThrow({ where: { id: sittingId } });
  return { finalized, state: fresh.state };
}

/**
 * After written marking and moderation complete for every sitting in the
 * window (rule 12) — computes totalPercent, resolves outcome against
 * passMarkPercent, stores the band, recomputes ProgrammeResult for any
 * pathway sitting, and releases every sitting in the window at once
 * (never per candidate).
 */
export async function releaseResults(windowId: string, staffId: string, ipAddress: string | null) {
  const window = await prisma.examWindow.findUniqueOrThrow({ where: { id: windowId }, include: { exam: true } });

  const sittings = await prisma.sitting.findMany({
    where: { registration: { windowId }, state: "SUBMITTED" },
    include: { registration: true, answers: { include: { question: true } } },
  });

  let releasedCount = 0;
  for (const sitting of sittings) {
    const writtenAnswerIds = sitting.answers.filter((a) => a.question.type === "WRITTEN").map((a) => a.id);
    const marks = writtenAnswerIds.length
      ? await prisma.mark.findMany({ where: { examWrittenAnswerId: { in: writtenAnswerIds } } })
      : [];
    const allReturned = marks.every((m) => m.state === "RETURNED");
    if (writtenAnswerIds.length > 0 && (!allReturned || marks.length < writtenAnswerIds.length)) {
      continue; // not every written answer is marked yet — this sitting waits for the next release pass
    }

    const writtenMarksScored = marks.filter((m) => m.scorePercent != null);
    const writtenPercent =
      writtenMarksScored.length > 0
        ? Math.round(writtenMarksScored.reduce((sum, m) => sum + (m.scorePercent ?? 0), 0) / writtenMarksScored.length)
        : null;

    // Weighted by marks available in each component, not a fixed split —
    // the paper's own objective/written marks distribution decides it.
    const objectiveQuestions = sitting.answers.filter((a) => a.question.type === "OBJECTIVE");
    const writtenQuestions = sitting.answers.filter((a) => a.question.type === "WRITTEN");
    const objectiveMarksTotal = objectiveQuestions.reduce((s, a) => s + a.question.marks, 0);
    const writtenMarksTotal = writtenQuestions.reduce((s, a) => s + a.question.marks, 0);
    const totalMarks = objectiveMarksTotal + writtenMarksTotal;

    let totalPercent: number | null = null;
    if (totalMarks > 0) {
      const objectiveContribution = sitting.objectivePercent != null ? (sitting.objectivePercent * objectiveMarksTotal) / 100 : 0;
      const writtenContribution = writtenPercent != null ? (writtenPercent * writtenMarksTotal) / 100 : 0;
      totalPercent = Math.round(((objectiveContribution + writtenContribution) / totalMarks) * 100);
    } else if (sitting.objectivePercent != null) {
      totalPercent = sitting.objectivePercent;
    }

    const outcome = totalPercent != null && totalPercent >= window.exam.passMarkPercent ? "PASS" : "REFER";
    const now = new Date();
    const band = totalPercent != null ? await resolveGradeBand(totalPercent, now, prisma) : null;

    await prisma.sitting.update({
      where: { id: sitting.id },
      data: { state: "RELEASED", writtenPercent, totalPercent, outcome, band, releasedAt: now },
    });

    if (sitting.registration.enrolmentId) {
      await recomputeProgrammeResult(sitting.registration.enrolmentId, prisma);
    }

    // Both the pathway and exam-only routes earn a certificate on PASS
    // (Slice 07 rule 4) — issueCertificate itself re-reads the sitting
    // FOR UPDATE and is idempotent, so a retried release never double-issues.
    if (outcome === "PASS") {
      await issueCertificate(sitting.id, staffId);
    }

    releasedCount++;
  }

  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "exam_window",
    subjectId: windowId,
    action: "exam_window.results_released",
    description: `Released results for ${releasedCount} sitting${releasedCount === 1 ? "" : "s"}`,
    ipAddress,
  });

  return { releasedCount, totalSubmitted: sittings.length };
}
