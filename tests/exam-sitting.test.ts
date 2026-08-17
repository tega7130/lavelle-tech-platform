import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { drawPaper, type DrawableQuestion } from "@/lib/exam-draw";
import { checkExamEligibility } from "@/lib/exam-eligibility";
import {
  publishExam,
  updateExamQuestion,
  createExamQuestion,
  createExam,
  createExamWindow,
  closeExam,
  archiveExam,
  setExamContent,
  setExamRequirements,
  createStandaloneExam,
  addExamModule,
  updateExamModule,
  PublishBlockedError,
} from "@/lib/exam-builder-actions";
import { listProgrammes } from "@/lib/programme-reads";
import { getExamIdByProgrammeCode, getExamResultForCandidate } from "@/lib/exam-candidate-reads";
import {
  registerForExam,
  startSitting,
  saveSittingAnswer,
  submitSitting,
  forfeitSitting,
  expireOverdueSittings,
  releaseResults,
  evaluateAttemptGate,
  IneligibleError,
  SittingExpiredError,
  AttemptLimitReachedError,
  PaymentRequiredError,
} from "@/lib/exam-sitting-actions";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Exam Staff", email: `exam-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Exam Test Category ${crypto.randomUUID()}`, slug: `exam-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function seedProgramme(categoryId: string, staffId: string, tier: "FOUNDATION" | "SPECIALIST" | "ADVANCED_PRACTITIONER" = "SPECIALIST") {
  return testPrisma.programme.create({
    data: {
      code: `EXM-${crypto.randomUUID().slice(0, 8)}`,
      title: `Exam Test Programme ${tier}`,
      categoryId,
      tier,
      status: "ACTIVE",
      summary: "test",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      credits: 24,
      feeMinor: 45_000_000,
      createdByStaffId: staffId,
    },
  });
}

async function seedModule(programmeId: string, draw = 2) {
  return testPrisma.module.create({
    data: { programmeId, weekNumber: 1, title: "Week 1", orderIndex: 0, examQuestionDraw: draw },
  });
}

async function seedExam(programmeId: string, opts: Partial<{ status: "DRAFT" | "PUBLISHED"; durationMinutes: number; passMarkPercent: number }> = {}) {
  return testPrisma.exam.create({
    data: {
      programmeId,
      status: opts.status ?? "PUBLISHED",
      durationMinutes: opts.durationMinutes ?? 120,
      passMarkPercent: opts.passMarkPercent ?? 60,
      feeMinor: 8_500_000,
    },
  });
}

async function seedObjectiveQuestion(examId: string, moduleId: string, opts: { status?: "DRAFT" | "APPROVED"; correctIndex?: number } = {}) {
  return testPrisma.examQuestion.create({
    data: {
      examId,
      moduleId,
      type: "OBJECTIVE",
      status: opts.status ?? "APPROVED",
      prompt: `Objective question ${crypto.randomUUID().slice(0, 6)}`,
      marks: 2,
      options: {
        create: [0, 1, 2, 3].map((i) => ({ orderIndex: i, text: `Option ${i}`, isCorrect: i === (opts.correctIndex ?? 0) })),
      },
    },
    include: { options: true },
  });
}

async function seedWrittenQuestion(examId: string, moduleId: string, opts: { status?: "DRAFT" | "APPROVED" } = {}) {
  return testPrisma.examQuestion.create({
    data: { examId, moduleId, type: "WRITTEN", status: opts.status ?? "APPROVED", prompt: `Written question ${crypto.randomUUID().slice(0, 6)}`, marks: 10 },
  });
}

async function seedCandidate() {
  return testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
      firstName: "Chidera",
      lastName: "Nwachukwu",
      email: `exam-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
}

async function seedWindow(examId: string, opts: Partial<{ opensAt: Date; closesAt: Date; registrationDeadline: Date }> = {}) {
  const now = Date.now();
  return testPrisma.examWindow.create({
    data: {
      examId,
      opensAt: opts.opensAt ?? new Date(now - 60_000),
      closesAt: opts.closesAt ?? new Date(now + 3_600_000),
      registrationDeadline: opts.registrationDeadline ?? new Date(now + 3_600_000),
    },
  });
}

async function seedPaidRegistration(candidateId: string, examId: string, windowId: string, enrolmentId: string | null = null) {
  const payment = await testPrisma.payment.create({
    data: {
      candidateId,
      purpose: "EXAMINATION_FEE",
      amountMinor: 8_500_000,
      provider: "paystack",
      internalReference: `LVL-PAY-TEST-${crypto.randomUUID().slice(0, 8)}`,
      status: "SUCCESS",
      confirmedAt: new Date(),
    },
  });
  return testPrisma.examRegistration.create({
    data: { candidateId, examId, windowId, enrolmentId, paymentId: payment.id, attemptNumber: 1, registeredAt: new Date() },
  });
}

async function seedCompletedSpecialistEnrolment(candidateId: string, categoryId: string, staffId: string) {
  const specialistProgramme = await seedProgramme(categoryId, staffId, "SPECIALIST");
  const intake = await testPrisma.intake.create({
    data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
  });
  const enrolment = await testPrisma.enrolment.create({
    data: { candidateId, programmeId: specialistProgramme.id, intakeId: intake.id, status: "COMPLETED", enrolledAt: new Date() },
  });
  return { specialistProgramme, intake, enrolment };
}

async function cleanupCandidates(candidateIds: string[]) {
  if (candidateIds.length) await testPrisma.candidate.deleteMany({ where: { id: { in: candidateIds } } });
}

async function cleanupProgramme(programmeId: string) {
  const exam = await testPrisma.exam.findUnique({ where: { programmeId } });
  if (exam) {
    await testPrisma.examQuestionOption.deleteMany({ where: { question: { examId: exam.id } } });
    await testPrisma.examQuestion.deleteMany({ where: { examId: exam.id } });
    await testPrisma.examWindow.deleteMany({ where: { examId: exam.id } });
    await testPrisma.exam.delete({ where: { id: exam.id } });
  }
  await testPrisma.module.deleteMany({ where: { programmeId } });
  await testPrisma.programme.delete({ where: { id: programmeId } });
}

async function cleanupRoot(opts: { categoryId: string; staffId: string; intakeIds?: string[] }) {
  // A PASSing sitting released via releaseResults now also issues a
  // certificate (Slice 07) — its rendered-PDF MediaAsset is owned by
  // this staffId and RESTRICT-guards staff deletion, same as the
  // Slice 07 test suite's own cleanup.
  await testPrisma.mediaAsset.deleteMany({ where: { uploadedByStaffId: opts.staffId } });
  await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  await testPrisma.staff.delete({ where: { id: opts.staffId } });
  if (opts.intakeIds?.length) await testPrisma.intake.deleteMany({ where: { id: { in: opts.intakeIds } } });
}

describe("publishExam — blocked while any module is short of approved objective questions (rule 1)", () => {
  it("names the offending module and refuses to publish, then succeeds once approved", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 2);
    const exam = await seedExam(programme.id, { status: "DRAFT" });
    // Only one approved objective question against a draw of 2.
    await seedObjectiveQuestion(exam.id, mod.id, { status: "APPROVED" });

    await expect(publishExam(exam.id, staff.id, null)).rejects.toThrow(PublishBlockedError);
    try {
      await publishExam(exam.id, staff.id, null);
    } catch (e) {
      expect(e).toBeInstanceOf(PublishBlockedError);
      const issues = (e as PublishBlockedError).issues;
      expect(issues.some((i) => i.message.includes(mod.title))).toBe(true);
      // Missing content and a missing window are reported too — the checklist is complete, not fail-fast.
      expect(issues.some((i) => i.action === "add_window")).toBe(true);
      expect(issues.some((i) => i.action === "edit_content")).toBe(true);
    }

    await seedObjectiveQuestion(exam.id, mod.id, { status: "APPROVED" });
    await seedWindow(exam.id);
    await testPrisma.exam.update({
      where: { id: exam.id },
      data: { description: "About this exam.", examFormat: "Objective + written", examinationAreas: ["Area one"], onPassing: ["Benefit one"] },
    });
    const published = await publishExam(exam.id, staff.id, null);
    expect(published.status).toBe("PUBLISHED");

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("drawPaper — type-aware: objective sliced to the module's draw, every approved written question included regardless of position (rule 2)", () => {
  it("never drops a written question sitting behind the objective slice cutoff", () => {
    const moduleId = "mod-1";
    // Written questions placed FIRST — a naive slice(0, draw) across the
    // whole array would keep these and drop the objectives instead, or
    // (the real historical bug) a slice that ignores type would drop
    // written questions sitting past the draw count if they were last.
    const questions: DrawableQuestion[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `written-${i}`,
        moduleId,
        type: "WRITTEN" as const,
        status: "APPROVED" as const,
        prompt: `Written ${i}`,
        marks: 10,
        guidance: null,
        wordLimit: 300,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `obj-${i}`,
        moduleId,
        type: "OBJECTIVE" as const,
        status: "APPROVED" as const,
        prompt: `Objective ${i}`,
        marks: 2,
        guidance: null,
        wordLimit: null,
        options: [
          { id: `${i}-a`, text: "A", isCorrect: true },
          { id: `${i}-b`, text: "B", isCorrect: false },
        ],
      })),
    ];

    const paper = drawPaper([{ moduleId, draw: 2 }], questions, { shuffleQuestions: false, shuffleOptions: false });
    const written = paper.filter((q) => q.type === "WRITTEN");
    const objective = paper.filter((q) => q.type === "OBJECTIVE");
    expect(written).toHaveLength(3); // all three, never sliced
    expect(objective).toHaveLength(2); // clamped to the module's draw
  });

  it("clamps to the module's own approved pool, never drawing more than exists", () => {
    const moduleId = "mod-2";
    const questions: DrawableQuestion[] = [
      { id: "obj-1", moduleId, type: "OBJECTIVE", status: "APPROVED", prompt: "Q", marks: 2, guidance: null, wordLimit: null, options: [{ id: "a", text: "A", isCorrect: true }] },
    ];
    const paper = drawPaper([{ moduleId, draw: 5 }], questions, { shuffleQuestions: false, shuffleOptions: false });
    expect(paper).toHaveLength(1);
  });
});

describe("paperSnapshot — written once at startSitting and never re-drawn (rule 3)", () => {
  it("is stable across a reload (idempotent startSitting) and immune to a mid-window question edit", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id);
    const question = await seedObjectiveQuestion(exam.id, mod.id);
    const candidate = await seedCandidate();
    const window = await seedWindow(exam.id);
    const registration = await seedPaidRegistration(candidate.id, exam.id, window.id);

    const first = await startSitting(registration.id, candidate.id);
    const originalPrompt = (first.paperSnapshot as { prompt: string }[])[0]!.prompt;
    expect(originalPrompt).toBe(question.prompt);

    // "Reload" — calling startSitting again for the same registration must
    // return the SAME sitting, not redraw a new paper.
    const reloaded = await startSitting(registration.id, candidate.id);
    expect(reloaded.id).toBe(first.id);
    expect(reloaded.paperSnapshot).toEqual(first.paperSnapshot);

    // A staff edit to the live question, mid-window, must never reach a
    // paper already drawn — the snapshot, not ExamQuestion, is the source
    // of truth for anyone already sitting.
    await updateExamQuestion(question.id, { prompt: "An entirely rewritten prompt" });
    const stillFrozen = await testPrisma.sitting.findUniqueOrThrow({ where: { id: first.id } });
    const frozenPrompt = (stillFrozen.paperSnapshot as { prompt: string }[])[0]!.prompt;
    expect(frozenPrompt).toBe(originalPrompt);
    expect(frozenPrompt).not.toBe("An entirely rewritten prompt");

    await cleanupCandidates([candidate.id]);
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("the server-owned clock — expiresAt is computed once and every write checks it regardless of the client (rule 4/7)", () => {
  it("rejects an autosave and a submit once the server's own expiresAt has passed, no matter what the client believes", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id);
    const question = await seedObjectiveQuestion(exam.id, mod.id);
    const candidate = await seedCandidate();
    const window = await seedWindow(exam.id);
    const registration = await seedPaidRegistration(candidate.id, exam.id, window.id);
    const sitting = await startSitting(registration.id, candidate.id);

    // A working save while time remains.
    await saveSittingAnswer(sitting.id, candidate.id, { questionId: question.id, selectedOptionId: question.options[0]!.id });

    // Simulate time passing server-side — this is "clock tampering" from
    // the other direction: nothing the CLIENT can send changes this, only
    // the server's own stored expiresAt does, and here we move only that.
    await testPrisma.sitting.update({ where: { id: sitting.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(saveSittingAnswer(sitting.id, candidate.id, { questionId: question.id, selectedOptionId: question.options[1]!.id })).rejects.toThrow(
      SittingExpiredError
    );
    await expect(submitSitting(sitting.id, candidate.id)).rejects.toThrow(SittingExpiredError);

    // The rejected write never landed — proves it's not silently accepted then discarded.
    const answer = await testPrisma.sittingAnswer.findUniqueOrThrow({ where: { sittingId_questionId: { sittingId: sitting.id, questionId: question.id } } });
    expect(answer.selectedOptionId).toBe(question.options[0]!.id);

    await cleanupCandidates([candidate.id]);
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("forfeit versus expiry — distinct states, distinct consequences (rule 6/8)", () => {
  it("forfeit marks nothing and cancels the registration; expiry marks what was answered and leaves the registration open", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id);
    const written = await seedWrittenQuestion(exam.id, mod.id);
    const candidateA = await seedCandidate();
    const candidateB = await seedCandidate();
    const window = await seedWindow(exam.id);

    // Forfeit path.
    const regA = await seedPaidRegistration(candidateA.id, exam.id, window.id);
    const sittingA = await startSitting(regA.id, candidateA.id);
    await saveSittingAnswer(sittingA.id, candidateA.id, { questionId: written.id, writtenAnswer: "A partial answer." });
    const forfeited = await forfeitSitting(sittingA.id, candidateA.id);
    expect(forfeited.state).toBe("FORFEITED");
    expect(forfeited.forfeitedAt).not.toBeNull();
    const regAAfter = await testPrisma.examRegistration.findUniqueOrThrow({ where: { id: regA.id } });
    expect(regAAfter.cancelledAt).not.toBeNull();
    const marksForA = await testPrisma.mark.findMany({ where: { examWrittenAnswerId: { not: null }, examWrittenAnswer: { sittingId: sittingA.id } } });
    expect(marksForA).toHaveLength(0);

    // Expiry path.
    const regB = await seedPaidRegistration(candidateB.id, exam.id, window.id);
    const sittingB = await startSitting(regB.id, candidateB.id);
    await saveSittingAnswer(sittingB.id, candidateB.id, { questionId: written.id, writtenAnswer: "Another answer, this one expires." });
    await testPrisma.sitting.update({ where: { id: sittingB.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expiredCount = await expireOverdueSittings();
    expect(expiredCount).toBeGreaterThanOrEqual(1);
    const sittingBAfter = await testPrisma.sitting.findUniqueOrThrow({ where: { id: sittingB.id } });
    expect(sittingBAfter.state).toBe("EXPIRED");
    const regBAfter = await testPrisma.examRegistration.findUniqueOrThrow({ where: { id: regB.id } });
    expect(regBAfter.cancelledAt).toBeNull(); // expiry is not forfeiture — the registration itself is untouched
    const marksForB = await testPrisma.mark.findMany({ where: { examWrittenAnswerId: { not: null }, examWrittenAnswer: { sittingId: sittingB.id } } });
    expect(marksForB).toHaveLength(1); // IS queued for marking, unlike a forfeit
    expect(marksForB[0]!.state).toBe("AWAITING");
    expect(marksForB[0]!.kind).toBe("EXAMINATION_WRITTEN");

    await cleanupCandidates([candidateA.id, candidateB.id]);
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("prerequisite enforcement — Advanced Practitioner requires a COMPLETED Specialist enrolment in the SAME category (Eligibility table)", () => {
  it("blocks a candidate with no qualifying enrolment, blocks one in the wrong category, and admits one who holds it", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const otherCategory = await testPrisma.programmeCategory.create({
      data: { name: `Other Category ${crypto.randomUUID()}`, slug: `other-cat-${crypto.randomUUID()}` },
    });
    const advancedProgramme = await seedProgramme(category.id, staff.id, "ADVANCED_PRACTITIONER");
    const exam = await seedExam(advancedProgramme.id);
    const window = await seedWindow(exam.id);

    const candidateNone = await seedCandidate();
    const verdictNone = await checkExamEligibility(candidateNone.id, advancedProgramme);
    expect(verdictNone.eligible).toBe(false);
    expect(verdictNone.prerequisiteRequired).toBe(true);
    await expect(registerForExam(exam.id, window.id, candidateNone.id, candidateNone.email)).rejects.toThrow(IneligibleError);

    const candidateWrongCategory = await seedCandidate();
    const wrong = await seedCompletedSpecialistEnrolment(candidateWrongCategory.id, otherCategory.id, staff.id);
    const verdictWrong = await checkExamEligibility(candidateWrongCategory.id, advancedProgramme);
    expect(verdictWrong.eligible).toBe(false); // completed, but the WRONG specialization

    const candidateQualified = await seedCandidate();
    const right = await seedCompletedSpecialistEnrolment(candidateQualified.id, category.id, staff.id);
    const verdictRight = await checkExamEligibility(candidateQualified.id, advancedProgramme);
    expect(verdictRight.eligible).toBe(true);
    expect(verdictRight.prerequisiteProgrammeTitle).toBe(right.specialistProgramme.title);
    const registration = await registerForExam(exam.id, window.id, candidateQualified.id, candidateQualified.email);
    expect(registration.registration.examId).toBe(exam.id);

    await cleanupCandidates([candidateNone.id, candidateWrongCategory.id, candidateQualified.id]);
    await cleanupProgramme(wrong.specialistProgramme.id);
    await cleanupProgramme(right.specialistProgramme.id);
    await testPrisma.intake.delete({ where: { id: wrong.intake.id } });
    await testPrisma.intake.delete({ where: { id: right.intake.id } });
    await cleanupProgramme(advancedProgramme.id);
    await testPrisma.programmeCategory.delete({ where: { id: otherCategory.id } });
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("releaseResults — a whole window at once, never a sitting whose written marking isn't finished (rule 12)", () => {
  it("releases only the fully-marked sitting, leaves the other SUBMITTED, and records exactly one audit event for the window", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id, { passMarkPercent: 50 });
    const objective = await seedObjectiveQuestion(exam.id, mod.id, { correctIndex: 0 });
    const written = await seedWrittenQuestion(exam.id, mod.id);
    const window = await seedWindow(exam.id);

    const candidateReady = await seedCandidate();
    const regReady = await seedPaidRegistration(candidateReady.id, exam.id, window.id);
    const sittingReady = await startSitting(regReady.id, candidateReady.id);
    await saveSittingAnswer(sittingReady.id, candidateReady.id, { questionId: objective.id, selectedOptionId: objective.options.find((o) => o.isCorrect)!.id });
    await saveSittingAnswer(sittingReady.id, candidateReady.id, { questionId: written.id, writtenAnswer: "A full answer." });
    await submitSitting(sittingReady.id, candidateReady.id);
    const answerReady = await testPrisma.sittingAnswer.findUniqueOrThrow({ where: { sittingId_questionId: { sittingId: sittingReady.id, questionId: written.id } } });
    await testPrisma.mark.update({
      where: { examWrittenAnswerId: answerReady.id },
      data: { state: "RETURNED", scorePercent: 80, feedback: "Well argued.", markedByStaffId: staff.id, markedAt: new Date() },
    });

    const candidatePending = await seedCandidate();
    const regPending = await seedPaidRegistration(candidatePending.id, exam.id, window.id);
    const sittingPending = await startSitting(regPending.id, candidatePending.id);
    await saveSittingAnswer(sittingPending.id, candidatePending.id, { questionId: objective.id, selectedOptionId: objective.options.find((o) => o.isCorrect)!.id });
    await saveSittingAnswer(sittingPending.id, candidatePending.id, { questionId: written.id, writtenAnswer: "Still awaiting a marker." });
    await submitSitting(sittingPending.id, candidatePending.id);
    // Its written Mark stays AWAITING — never touched.

    const auditCountBefore = await testPrisma.auditEvent.count({ where: { subjectType: "exam_window", subjectId: window.id } });
    const result = await releaseResults(window.id, staff.id, null);
    expect(result.releasedCount).toBe(1);
    expect(result.totalSubmitted).toBe(2);

    const readyAfter = await testPrisma.sitting.findUniqueOrThrow({ where: { id: sittingReady.id } });
    expect(readyAfter.state).toBe("RELEASED");
    expect(readyAfter.outcome).toBe("PASS");
    expect(readyAfter.totalPercent).not.toBeNull();

    // The candidate-facing result surfaces who marked the written answer
    // and a certificate to download, once released and passed.
    const candidateResult = await getExamResultForCandidate(sittingReady.id, candidateReady.id);
    expect(candidateResult.markedByNames).toEqual([staff.name]);
    expect(candidateResult.certificateNumber).not.toBeNull();

    const pendingAfter = await testPrisma.sitting.findUniqueOrThrow({ where: { id: sittingPending.id } });
    expect(pendingAfter.state).toBe("SUBMITTED"); // untouched — waits for the next release pass

    const auditCountAfter = await testPrisma.auditEvent.count({ where: { subjectType: "exam_window", subjectId: window.id } });
    expect(auditCountAfter - auditCountBefore).toBe(1); // one event for the whole window, not per sitting

    await cleanupCandidates([candidateReady.id, candidatePending.id]);
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("startSitting requires a confirmed payment (Part 35 — a registration cannot start an attempt on an unpaid fee)", () => {
  it("rejects starting a sitting while the registration's payment is still PENDING, and allows it once confirmed", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id);
    await seedObjectiveQuestion(exam.id, mod.id);
    const candidate = await seedCandidate();
    const window = await seedWindow(exam.id);

    // registerForExam creates the EXAMINATION_FEE payment PENDING — never confirmed here.
    const { registration } = await registerForExam(exam.id, window.id, candidate.id, candidate.email);
    await expect(startSitting(registration.id, candidate.id)).rejects.toThrow(PaymentRequiredError);
    expect(await testPrisma.sitting.findUnique({ where: { registrationId: registration.id } })).toBeNull();

    await testPrisma.payment.update({ where: { id: registration.paymentId! }, data: { status: "SUCCESS", confirmedAt: new Date() } });
    const sitting = await startSitting(registration.id, candidate.id);
    expect(sitting.state).toBe("IN_PROGRESS");

    await cleanupCandidates([candidate.id]);
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("evaluateAttemptGate — the pure policy function behind AttemptPolicy (Part 35: Attempts permitted)", () => {
  it("ONE_ATTEMPT allows a first registration and blocks any further one, regardless of outcome", () => {
    expect(evaluateAttemptGate("ONE_ATTEMPT", 0, null).allowed).toBe(true);
    expect(evaluateAttemptGate("ONE_ATTEMPT", 1, "PASS").allowed).toBe(false);
    expect(evaluateAttemptGate("ONE_ATTEMPT", 1, "REFER").allowed).toBe(false);
    expect(evaluateAttemptGate("ONE_ATTEMPT", 1, null).allowed).toBe(false);
  });

  it("TWO_ATTEMPTS allows a second registration regardless of the first's outcome, and blocks a third", () => {
    expect(evaluateAttemptGate("TWO_ATTEMPTS", 1, "PASS").allowed).toBe(true);
    expect(evaluateAttemptGate("TWO_ATTEMPTS", 1, "REFER").allowed).toBe(true);
    expect(evaluateAttemptGate("TWO_ATTEMPTS", 1, null).allowed).toBe(true); // forfeited/unresolved still earns the second attempt
    expect(evaluateAttemptGate("TWO_ATTEMPTS", 2, "REFER").allowed).toBe(false);
  });

  it("ONE_RESIT_ON_REFERRAL earns a second attempt only after a REFER, never after a PASS or while unresolved, and caps at two", () => {
    expect(evaluateAttemptGate("ONE_RESIT_ON_REFERRAL", 0, null).allowed).toBe(true);
    expect(evaluateAttemptGate("ONE_RESIT_ON_REFERRAL", 1, "REFER").allowed).toBe(true);
    expect(evaluateAttemptGate("ONE_RESIT_ON_REFERRAL", 1, "PASS").allowed).toBe(false);
    expect(evaluateAttemptGate("ONE_RESIT_ON_REFERRAL", 1, null).allowed).toBe(false); // unsubmitted/unreleased/forfeited
    expect(evaluateAttemptGate("ONE_RESIT_ON_REFERRAL", 2, "REFER").allowed).toBe(false); // the resit itself is final
  });
});

describe("registerForExam enforces the attempt gate end to end (Part 35: Attempts permitted -> Attempt availability)", () => {
  it("ONE_ATTEMPT: a second registerForExam call for the same exam is rejected even for a different window", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id);
    await testPrisma.exam.update({ where: { id: exam.id }, data: { attemptPolicy: "ONE_ATTEMPT" } });
    await seedObjectiveQuestion(exam.id, mod.id);
    const candidate = await seedCandidate();
    const window1 = await seedWindow(exam.id);
    const window2 = await seedWindow(exam.id);

    await registerForExam(exam.id, window1.id, candidate.id, candidate.email);
    await expect(registerForExam(exam.id, window2.id, candidate.id, candidate.email)).rejects.toThrow(AttemptLimitReachedError);

    await cleanupCandidates([candidate.id]);
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("ONE_RESIT_ON_REFERRAL: a REFERRED first attempt unlocks a resit; a PASSED one does not", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id, { passMarkPercent: 50 });
    const question = await seedObjectiveQuestion(exam.id, mod.id, { correctIndex: 0 });
    const window1 = await seedWindow(exam.id);
    const window2 = await seedWindow(exam.id);
    const window3 = await seedWindow(exam.id);

    // A candidate who fails the first sitting earns exactly one resit.
    const referredCandidate = await seedCandidate();
    const regA = await seedPaidRegistration(referredCandidate.id, exam.id, window1.id);
    const sittingA = await startSitting(regA.id, referredCandidate.id);
    const wrongOption = question.options.find((o) => !o.isCorrect)!;
    await saveSittingAnswer(sittingA.id, referredCandidate.id, { questionId: question.id, selectedOptionId: wrongOption.id });
    await submitSitting(sittingA.id, referredCandidate.id);
    await releaseResults(window1.id, staff.id, null);
    const sittingAAfter = await testPrisma.sitting.findUniqueOrThrow({ where: { id: sittingA.id } });
    expect(sittingAAfter.outcome).toBe("REFER");

    const resit = await registerForExam(exam.id, window2.id, referredCandidate.id, referredCandidate.email);
    expect(resit.registration.attemptNumber).toBe(2);
    // The resit itself is final — a third registration is refused outright.
    await expect(registerForExam(exam.id, window3.id, referredCandidate.id, referredCandidate.email)).rejects.toThrow(AttemptLimitReachedError);

    // A candidate who passes the first sitting has nothing left to resit.
    const passedCandidate = await seedCandidate();
    const regB = await seedPaidRegistration(passedCandidate.id, exam.id, window1.id);
    const sittingB = await startSitting(regB.id, passedCandidate.id);
    const correctOption = question.options.find((o) => o.isCorrect)!;
    await saveSittingAnswer(sittingB.id, passedCandidate.id, { questionId: question.id, selectedOptionId: correctOption.id });
    await submitSitting(sittingB.id, passedCandidate.id);
    await releaseResults(window1.id, staff.id, null);
    const sittingBAfter = await testPrisma.sitting.findUniqueOrThrow({ where: { id: sittingB.id } });
    expect(sittingBAfter.outcome).toBe("PASS");
    await expect(registerForExam(exam.id, window2.id, passedCandidate.id, passedCandidate.email)).rejects.toThrow(AttemptLimitReachedError);

    await cleanupCandidates([referredCandidate.id, passedCandidate.id]);
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("getExamIdByProgrammeCode — a never-published exam stays invisible to the candidate portal (Part 35: Candidate visibility)", () => {
  it("resolves nothing for a DRAFT exam, but resolves once PUBLISHED", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const exam = await seedExam(programme.id, { status: "DRAFT" });

    expect(await getExamIdByProgrammeCode(programme.code)).toBeNull();

    await testPrisma.exam.update({ where: { id: exam.id }, data: { status: "PUBLISHED" } });
    expect(await getExamIdByProgrammeCode(programme.code)).toBe(exam.id);

    // CLOSED/ARCHIVED still resolve — an already-registered candidate must
    // keep reaching their own registration/result after the exam concludes.
    await testPrisma.exam.update({ where: { id: exam.id }, data: { status: "CLOSED" } });
    expect(await getExamIdByProgrammeCode(programme.code)).toBe(exam.id);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("exam-builder-actions — lifecycle and validation additions", () => {
  it("createExam requires one exam per programme; createExamWindow enforces date ordering", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);

    const exam = await createExam(programme.id, staff.id, null);
    expect(exam.status).toBe("DRAFT");
    expect(exam.durationMinutes).toBe(180);

    await expect(createExam(programme.id, staff.id, null)).rejects.toThrow("already has an examination");

    const now = Date.now();
    await expect(
      createExamWindow(
        exam.id,
        { opensAt: new Date(now + 100_000), closesAt: new Date(now + 200_000), registrationDeadline: new Date(now + 150_000) },
        staff.id,
        null
      )
    ).rejects.toThrow("Registration must close before");

    await expect(
      createExamWindow(
        exam.id,
        { opensAt: new Date(now + 200_000), closesAt: new Date(now + 100_000), registrationDeadline: new Date(now) },
        staff.id,
        null
      )
    ).rejects.toThrow("cannot close before it opens");

    const window = await createExamWindow(
      exam.id,
      { opensAt: new Date(now + 200_000), closesAt: new Date(now + 300_000), registrationDeadline: new Date(now + 100_000), capacity: 40 },
      staff.id,
      null
    );
    expect(window.capacity).toBe(40);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("createExamQuestion/updateExamQuestion reject non-positive marks and fewer than two options", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id, { status: "DRAFT" });

    await expect(
      createExamQuestion(exam.id, {
        moduleId: mod.id,
        type: "OBJECTIVE",
        prompt: "Q",
        marks: 0,
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      })
    ).rejects.toThrow("Marks must be a positive whole number");

    const q = await createExamQuestion(exam.id, {
      moduleId: mod.id,
      type: "OBJECTIVE",
      marks: 2,
      prompt: "Q",
      options: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: false },
      ],
    });

    await expect(updateExamQuestion(q.id, { options: [{ text: "Only one", isCorrect: true }] })).rejects.toThrow("at least two answer options");
    await expect(updateExamQuestion(q.id, { marks: -1 })).rejects.toThrow("Marks must be a positive whole number");

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("closeExam/archiveExam only permit the documented transitions", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const exam = await seedExam(programme.id, { status: "DRAFT" });

    await expect(closeExam(exam.id, staff.id, null)).rejects.toThrow("Only a published examination can be closed");
    await expect(archiveExam(exam.id, staff.id, null)).rejects.toThrow("Only a closed or published examination can be archived");

    await testPrisma.exam.update({ where: { id: exam.id }, data: { status: "PUBLISHED" } });
    const closed = await closeExam(exam.id, staff.id, null);
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedAt).not.toBeNull();

    const archived = await archiveExam(exam.id, staff.id, null);
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).not.toBeNull();

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("publishExam reopens a CLOSED or ARCHIVED exam back to PUBLISHED — an exam is reusable, not a one-way lifecycle", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const mod = await seedModule(programme.id, 1);
    const exam = await seedExam(programme.id, { status: "DRAFT" });
    await seedObjectiveQuestion(exam.id, mod.id, { status: "APPROVED" });
    await seedWindow(exam.id);
    await testPrisma.exam.update({
      where: { id: exam.id },
      data: { description: "About this exam.", examFormat: "Objective + written", examinationAreas: ["Area one"], onPassing: ["Benefit one"] },
    });
    await publishExam(exam.id, staff.id, null);

    const closed = await closeExam(exam.id, staff.id, null);
    expect(closed.status).toBe("CLOSED");
    const reopenedFromClosed = await publishExam(exam.id, staff.id, null);
    expect(reopenedFromClosed.status).toBe("PUBLISHED");

    const archived = await archiveExam(exam.id, staff.id, null);
    expect(archived.status).toBe("ARCHIVED");
    const reopenedFromArchived = await publishExam(exam.id, staff.id, null);
    expect(reopenedFromArchived.status).toBe("PUBLISHED");
    // A reopened exam can be closed again — the state machine isn't a dead end after reopening either.
    const closedAgain = await closeExam(exam.id, staff.id, null);
    expect(closedAgain.status).toBe("CLOSED");

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("setExamContent stores trimmed candidate-facing content and drops blank list entries", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const exam = await seedExam(programme.id, { status: "DRAFT" });

    const updated = await setExamContent(
      exam.id,
      { description: "  About this exam.  ", instructions: "", examFormat: "Objective + written", examinationAreas: ["Area one", "  ", ""], onPassing: ["Benefit one"] },
      staff.id,
      null
    );

    expect(updated.description).toBe("About this exam.");
    expect(updated.instructions).toBeNull();
    expect(updated.examinationAreas).toEqual(["Area one"]);
    expect(updated.onPassing).toEqual(["Benefit one"]);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("standalone exams and optional eligibility requirements", () => {
  it("createStandaloneExam creates an invisible shell programme, restricted to Foundation/Specialist tier", async () => {
    const { staff, category } = await seedStaffAndCategory();

    await expect(
      createStandaloneExam({ title: "Advanced Marketing Examination", code: `MKT-${crypto.randomUUID().slice(0, 6)}`, tier: "ADVANCED_PRACTITIONER" as never }, staff.id, null)
    ).rejects.toThrow("Foundation or Specialist");

    const code = `MKT-${crypto.randomUUID().slice(0, 6)}`;
    const exam = await createStandaloneExam({ title: "Advanced Marketing Examination", code, tier: "SPECIALIST", newCategoryName: `Marketing ${crypto.randomUUID()}` }, staff.id, null);

    const shell = await testPrisma.programme.findUniqueOrThrow({ where: { id: exam.programmeId } });
    expect(shell.isExamOnlyShell).toBe(true);
    expect(shell.status).toBe("DRAFT");
    expect(shell.title).toBe("Advanced Marketing Examination");

    const visible = await listProgrammes();
    expect(visible.some((p) => p.id === shell.id)).toBe(false);

    const catalogueVisible = await testPrisma.programme.findMany({ where: { id: shell.id, status: "ACTIVE" } });
    expect(catalogueVisible.length).toBe(0); // DRAFT status keeps it out of listCatalogue's status=ACTIVE filter too

    await testPrisma.exam.delete({ where: { id: exam.id } });
    await testPrisma.programme.delete({ where: { id: shell.id } });
    await testPrisma.programmeCategory.delete({ where: { id: shell.categoryId } });
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("createStandaloneExam rejects a duplicate examination code", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const code = `MKT-${crypto.randomUUID().slice(0, 6)}`;
    const first = await createStandaloneExam({ title: "First", code, tier: "FOUNDATION", newCategoryName: `Topic ${crypto.randomUUID()}` }, staff.id, null);

    await expect(
      createStandaloneExam({ title: "Second", code, tier: "FOUNDATION", newCategoryName: `Topic ${crypto.randomUUID()}` }, staff.id, null)
    ).rejects.toThrow("already in use");

    const shell = await testPrisma.programme.findUniqueOrThrow({ where: { id: first.programmeId } });
    await testPrisma.exam.delete({ where: { id: first.id } });
    await testPrisma.programme.delete({ where: { id: shell.id } });
    await testPrisma.programmeCategory.delete({ where: { id: shell.categoryId } });
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("addExamModule/updateExamModule let a standalone exam build its own question bank, and refuse a linked exam's programme", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const code = `MKT-${crypto.randomUUID().slice(0, 6)}`;
    const exam = await createStandaloneExam({ title: "Standalone Module Test", code, tier: "SPECIALIST", newCategoryName: `Topic ${crypto.randomUUID()}` }, staff.id, null);

    // A brand-new standalone exam has no modules at all yet.
    expect(await testPrisma.module.count({ where: { programmeId: exam.programmeId } })).toBe(0);

    const mod = await addExamModule(exam.id, { title: "Contract formation", examQuestionDraw: 3 }, staff.id, null);
    expect(mod.weekNumber).toBe(1);
    expect(mod.examQuestionDraw).toBe(3);

    // Once a module exists, the ordinary question-authoring path works exactly as for a linked exam.
    const question = await createExamQuestion(exam.id, {
      moduleId: mod.id,
      type: "OBJECTIVE",
      marks: 2,
      prompt: "Q",
      options: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: false },
      ],
    });
    expect(question.moduleId).toBe(mod.id);

    const updated = await updateExamModule(mod.id, { title: "Contract formation (revised)", examQuestionDraw: 4 }, staff.id, null);
    expect(updated.title).toBe("Contract formation (revised)");
    expect(updated.examQuestionDraw).toBe(4);

    // A second module continues the weekNumber/orderIndex sequence.
    const mod2 = await addExamModule(exam.id, { title: "Remedies", examQuestionDraw: 2 }, staff.id, null);
    expect(mod2.weekNumber).toBe(2);
    expect(mod2.orderIndex).toBe(1);

    // A LINKED exam's programme has real candidate-facing content — its modules must come from the content editor, not here.
    const linkedProgramme = await seedProgramme(category.id, staff.id);
    const linkedModule = await seedModule(linkedProgramme.id, 2);
    const linkedExam = await seedExam(linkedProgramme.id, { status: "DRAFT" });
    await expect(addExamModule(linkedExam.id, { title: "Should fail", examQuestionDraw: 2 }, staff.id, null)).rejects.toThrow("content editor");
    await expect(updateExamModule(linkedModule.id, { title: "Should fail", examQuestionDraw: 2 }, staff.id, null)).rejects.toThrow("content editor");

    await testPrisma.examQuestionOption.deleteMany({ where: { question: { examId: exam.id } } });
    await testPrisma.examQuestion.deleteMany({ where: { examId: exam.id } });
    await testPrisma.module.deleteMany({ where: { programmeId: exam.programmeId } });
    const shellCategoryId = (await testPrisma.programme.findUniqueOrThrow({ where: { id: exam.programmeId } })).categoryId;
    await testPrisma.exam.delete({ where: { id: exam.id } });
    await testPrisma.programme.delete({ where: { id: exam.programmeId } });
    await testPrisma.programmeCategory.delete({ where: { id: shellCategoryId } });
    await cleanupProgramme(linkedProgramme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("setExamRequirements: empty list means open to all; rows are replaced wholesale on each save", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    const exam = await seedExam(programme.id, { status: "DRAFT" });

    const openToAll = await setExamRequirements(exam.id, [], staff.id, null);
    expect(openToAll).toEqual([]);

    const withReqs = await setExamRequirements(
      exam.id,
      [
        { text: "A valid law degree", isMandatory: true },
        { text: "2 years of practice", isMandatory: false },
        { text: "  ", isMandatory: true }, // blank rows are dropped
      ],
      staff.id,
      null
    );
    expect(withReqs).toHaveLength(2);
    expect(withReqs[0]).toMatchObject({ text: "A valid law degree", isMandatory: true });
    expect(withReqs[1]).toMatchObject({ text: "2 years of practice", isMandatory: false });

    const replaced = await setExamRequirements(exam.id, [{ text: "Only this one now", isMandatory: true }], staff.id, null);
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.text).toBe("Only this one now");

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});
