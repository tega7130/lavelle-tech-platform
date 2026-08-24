import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { resetEnrolmentProgress, EnrolmentNotFoundError } from "@/lib/candidate-progress";
import { completeStep, startQuizAttempt, submitQuizAttempt } from "@/lib/player-actions";
import { generateDeadlinesForEnrolment } from "@/lib/deadline-generation";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Reset Staff", email: `reset-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Reset Test Category ${crypto.randomUUID()}`, slug: `reset-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function seedProgramme(staffId: string, categoryId: string) {
  return testPrisma.programme.create({
    data: {
      code: `RST-${crypto.randomUUID().slice(0, 8)}`,
      title: "Reset Test Programme",
      categoryId,
      tier: "SPECIALIST",
      status: "ACTIVE",
      summary: "test",
      weeks: 4,
      weeklyHoursLabel: "6-8 hrs / week",
      feeMinor: 10_000_000,
      createdByStaffId: staffId,
    },
  });
}

async function seedCandidateAndEnrolment(programmeId: string, intakeId: string) {
  const candidate = await testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
      firstName: "Reset",
      lastName: "Candidate",
      email: `reset-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
  const enrolment = await testPrisma.enrolment.create({
    data: { candidateId: candidate.id, programmeId, intakeId, status: "ACTIVE", enrolledAt: new Date() },
  });
  return { candidate, enrolment };
}

async function cleanup(opts: { candidateId?: string; programmeId?: string; categoryId?: string; staffId?: string; intakeId?: string }) {
  if (opts.candidateId) {
    // audit_event is append-only at the DB grant level (INSERT/SELECT only
    // for the app role) — rows created during the test are left in place,
    // same as every other test file that touches recordAuditEvent.
    await testPrisma.quizAnswer.deleteMany({ where: { attempt: { enrolment: { candidateId: opts.candidateId } } } });
    await testPrisma.quizAttempt.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.deadline.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.lectureProgress.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.draftingSubmission.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.programmeResult.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.enrolment.deleteMany({ where: { candidateId: opts.candidateId } });
    await testPrisma.candidate.delete({ where: { id: opts.candidateId } });
  }
  if (opts.programmeId) await testPrisma.programme.delete({ where: { id: opts.programmeId } });
  if (opts.categoryId) await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  if (opts.staffId) await testPrisma.staff.delete({ where: { id: opts.staffId } });
  if (opts.intakeId) await testPrisma.intake.delete({ where: { id: opts.intakeId } });
}

describe("resetEnrolmentProgress — wipes coursework, keeps the enrolment and payment", () => {
  it("clears lecture progress, quiz attempts and deadlines, then regenerates a fresh schedule", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 0, title: "Lecture 1", mediaKind: "VIDEO" } });
    const quiz = await testPrisma.quiz.create({ data: { moduleId: mod.id, passMarkPercent: 50 } });
    await testPrisma.quizQuestion.create({
      data: { quizId: quiz.id, orderIndex: 0, prompt: "2+2?", options: { create: [{ orderIndex: 0, text: "4", isCorrect: true }, { orderIndex: 1, text: "5", isCorrect: false }] } },
    });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    await completeStep(candidate.id, enrolment.id, lecture.id, "content");
    const attempt = await startQuizAttempt(candidate.id, enrolment.id, quiz.id);
    await submitQuizAttempt(candidate.id, attempt.attemptId, []);
    await generateDeadlinesForEnrolment(enrolment.id, testPrisma);

    expect(await testPrisma.lectureProgress.count({ where: { enrolmentId: enrolment.id } })).toBeGreaterThan(0);
    expect(await testPrisma.quizAttempt.count({ where: { enrolmentId: enrolment.id } })).toBeGreaterThan(0);
    const deadlinesBefore = await testPrisma.deadline.count({ where: { enrolmentId: enrolment.id } });
    expect(deadlinesBefore).toBeGreaterThan(0);

    await resetEnrolmentProgress(enrolment.id, "Candidate requested a restart", staff.id);

    expect(await testPrisma.lectureProgress.count({ where: { enrolmentId: enrolment.id } })).toBe(0);
    expect(await testPrisma.quizAttempt.count({ where: { enrolmentId: enrolment.id } })).toBe(0);
    expect(await testPrisma.quizAnswer.count({ where: { attempt: { enrolmentId: enrolment.id } } })).toBe(0);

    // Deadlines were deleted then regenerated fresh, not left stale.
    const deadlinesAfter = await testPrisma.deadline.findMany({ where: { enrolmentId: enrolment.id } });
    expect(deadlinesAfter.length).toBe(deadlinesBefore);

    const auditRow = await testPrisma.auditEvent.findFirstOrThrow({ where: { subjectType: "enrolment", subjectId: enrolment.id } });
    expect(auditRow.action).toBe("enrolment.progress_reset");
    expect(auditRow.reason).toBe("Candidate requested a restart");
    expect(auditRow.actorStaffId).toBe(staff.id);

    // The enrolment and payment story are untouched by a reset.
    const enrolmentAfter = await testPrisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } });
    expect(enrolmentAfter.status).toBe("ACTIVE");
    expect(enrolmentAfter.completedAt).toBeNull();

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("flips a COMPLETED enrolment back to ACTIVE and clears completedAt", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "APRIL", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);
    await testPrisma.enrolment.update({ where: { id: enrolment.id }, data: { status: "COMPLETED", completedAt: new Date() } });

    await resetEnrolmentProgress(enrolment.id, "Content changed, re-doing the programme", staff.id);

    const after = await testPrisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.completedAt).toBeNull();

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("only touches the targeted enrolment — a second programme's progress for the same candidate is untouched", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programmeA = await seedProgramme(staff.id, category.id);
    const programmeB = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "SEPTEMBER", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const modA = await testPrisma.module.create({ data: { programmeId: programmeA.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lectureA = await testPrisma.lecture.create({ data: { moduleId: modA.id, orderIndex: 0, title: "Lecture A", mediaKind: "VIDEO" } });
    const modB = await testPrisma.module.create({ data: { programmeId: programmeB.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lectureB = await testPrisma.lecture.create({ data: { moduleId: modB.id, orderIndex: 0, title: "Lecture B", mediaKind: "VIDEO" } });

    const candidate = await testPrisma.candidate.create({
      data: {
        applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
        candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
        firstName: "Dual",
        lastName: "Enrolled",
        email: `reset-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    const enrolmentA = await testPrisma.enrolment.create({ data: { candidateId: candidate.id, programmeId: programmeA.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() } });
    const enrolmentB = await testPrisma.enrolment.create({ data: { candidateId: candidate.id, programmeId: programmeB.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() } });

    await completeStep(candidate.id, enrolmentA.id, lectureA.id, "content");
    await completeStep(candidate.id, enrolmentB.id, lectureB.id, "content");

    await resetEnrolmentProgress(enrolmentA.id, "Restart programme A only", staff.id);

    expect(await testPrisma.lectureProgress.count({ where: { enrolmentId: enrolmentA.id } })).toBe(0);
    expect(await testPrisma.lectureProgress.count({ where: { enrolmentId: enrolmentB.id } })).toBe(1); // untouched

    // programmeB's enrolment/progress must go before programmeB itself, and
    // both before the shared category — cleanup() only knows about programmeA.
    await testPrisma.lectureProgress.deleteMany({ where: { enrolmentId: enrolmentB.id } });
    await testPrisma.deadline.deleteMany({ where: { enrolmentId: enrolmentB.id } });
    await testPrisma.enrolment.delete({ where: { id: enrolmentB.id } });
    await testPrisma.programme.delete({ where: { id: programmeB.id } });

    await cleanup({ candidateId: candidate.id, programmeId: programmeA.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("rejects an empty reason", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    await expect(resetEnrolmentProgress(enrolment.id, "   ", staff.id)).rejects.toThrow("A reason is required");

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("throws EnrolmentNotFoundError for an unknown enrolment id", async () => {
    const { staff } = await seedStaffAndCategory();
    await expect(resetEnrolmentProgress(crypto.randomUUID(), "reason", staff.id)).rejects.toThrow(EnrolmentNotFoundError);
    await testPrisma.staff.delete({ where: { id: staff.id } });
  });
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
