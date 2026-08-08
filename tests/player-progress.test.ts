import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { completeStep, submitQuizAttempt, startQuizAttempt, savePosition } from "@/lib/player-actions";
import { generateDeadlinesForEnrolment, extendDeadlinesForSuspension } from "@/lib/deadline-generation";
import { getProgrammeOverview } from "@/lib/player-reads";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Player Staff", email: `player-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Player Test Category ${crypto.randomUUID()}`, slug: `player-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function seedProgramme(staffId: string, categoryId: string) {
  return testPrisma.programme.create({
    data: {
      code: `PLR-${crypto.randomUUID().slice(0, 8)}`,
      title: "Player Test Programme",
      categoryId,
      tier: "SPECIALIST",
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

async function seedCandidateAndEnrolment(programmeId: string, intakeId: string) {
  const candidate = await testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
      firstName: "Test",
      lastName: "Candidate",
      email: `player-test-${crypto.randomUUID()}@example.com`,
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
    await testPrisma.quizAnswer.deleteMany({ where: { attempt: { enrolment: { candidateId: opts.candidateId } } } });
    await testPrisma.quizAttempt.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.deadline.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.lectureProgress.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.draftingSubmission.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.enrolment.deleteMany({ where: { candidateId: opts.candidateId } });
    await testPrisma.candidate.delete({ where: { id: opts.candidateId } });
  }
  if (opts.programmeId) await testPrisma.programme.delete({ where: { id: opts.programmeId } });
  if (opts.categoryId) await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  if (opts.staffId) await testPrisma.staff.delete({ where: { id: opts.staffId } });
  if (opts.intakeId) await testPrisma.intake.delete({ where: { id: opts.intakeId } });
}

describe("completeStep — a three-step lecture completes on content+scenario+drafting, never a hardcoded four", () => {
  it("stays IN_PROGRESS until all three authored steps are marked, then COMPLETED", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({
      data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 },
    });
    // No quiz on this module — deriveLectureSteps can never add a "quiz"
    // step, so this lecture's authored steps are exactly three.
    const lecture = await testPrisma.lecture.create({
      data: {
        moduleId: mod.id,
        orderIndex: 0,
        title: "Three Step Lecture",
        mediaKind: "VIDEO",
        scenarioPrompt: "A scenario.",
        draftingPrompt: "A drafting exercise.",
      },
    });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    const afterContent = await completeStep(candidate.id, enrolment.id, lecture.id, "content");
    expect(afterContent.state).toBe("IN_PROGRESS");
    expect(afterContent.isComplete).toBe(false);

    const afterScenario = await completeStep(candidate.id, enrolment.id, lecture.id, "scenario");
    expect(afterScenario.state).toBe("IN_PROGRESS");

    const afterDrafting = await completeStep(candidate.id, enrolment.id, lecture.id, "drafting");
    expect(afterDrafting.state).toBe("COMPLETED");
    expect(afterDrafting.isComplete).toBe(true);
    expect(afterDrafting.stepsCompleted.sort()).toEqual(["content", "drafting", "scenario"]);

    const row = await testPrisma.lectureProgress.findUniqueOrThrow({
      where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture.id } },
    });
    expect(row.completedAt).not.toBeNull();

    // Rejects a step that was never authored on this lecture — proves the
    // step list is recomputed server-side, not trusted from the caller.
    await expect(completeStep(candidate.id, enrolment.id, lecture.id, "quiz")).rejects.toThrow();

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });
});

describe("derived progress — recomputed from current lecture rows, never a stored percentage", () => {
  it("a lecture added to a module mid-enrolment changes the derived percent without touching any progress row", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "APRIL", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture1 = await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 0, title: "Lecture 1", mediaKind: "VIDEO" } });
    const lecture2 = await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 1, title: "Lecture 2", mediaKind: "VIDEO" } });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    await completeStep(candidate.id, enrolment.id, lecture1.id, "content");
    await completeStep(candidate.id, enrolment.id, lecture2.id, "content");

    const before = await getProgrammeOverview(candidate.id, enrolment.id);
    expect(before.programmePercent).toBe(100); // 2 of 2 lectures complete

    // Faculty adds a third lecture to the module mid-enrolment — no
    // LectureProgress row is created for it, and none of the existing two
    // rows are touched.
    const lecture3 = await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 2, title: "Lecture 3", mediaKind: "VIDEO" } });

    const after = await getProgrammeOverview(candidate.id, enrolment.id);
    expect(after.programmePercent).toBe(67); // 2 of 3 now — recomputed, not cached at 100
    const lecture3Progress = await testPrisma.lectureProgress.findUnique({
      where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture3.id } },
    });
    expect(lecture3Progress).toBeNull(); // NOT_STARTED is the absence of a row, never a stored value

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });
});

describe("quiz grading — always from the server's answer key, a tampered client payload changes nothing", () => {
  it("a client that claims the wrong option is correct is graded against the real key regardless", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "SEPTEMBER", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 0, title: "Only Lecture", mediaKind: "VIDEO" } });
    const quiz = await testPrisma.quiz.create({ data: { moduleId: mod.id, passMarkPercent: 60 } });
    const question = await testPrisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        orderIndex: 0,
        prompt: "2 + 2 = ?",
        options: {
          create: [
            { orderIndex: 0, text: "3", isCorrect: false },
            { orderIndex: 1, text: "4", isCorrect: true },
          ],
        },
      },
      include: { options: true },
    });
    const wrongOption = question.options.find((o) => !o.isCorrect)!;
    const correctOption = question.options.find((o) => o.isCorrect)!;

    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);
    const attempt = await startQuizAttempt(candidate.id, enrolment.id, quiz.id);
    expect(attempt.questions[0]!.options.every((o) => !("isCorrect" in o)))
      .toBe(true); // the client never even receives an isCorrect field pre-submission

    // Simulates a tampered request: selects the WRONG option, and (as a
    // real attacker's raw HTTP body could) carries an extra isCorrect:true
    // field the function's own type doesn't declare — proving the server
    // only ever reads questionId/selectedOptionId and looks up truth
    // itself, never trusting anything else in the payload.
    const tamperedAnswers = [
      { questionId: question.id, selectedOptionId: wrongOption.id, isCorrect: true } as unknown as {
        questionId: string;
        selectedOptionId: string | null;
      },
    ];

    const result = await submitQuizAttempt(candidate.id, attempt.attemptId, tamperedAnswers);
    expect(result.scorePercent).toBe(0); // graded correctly despite the tampered claim
    expect(result.passed).toBe(false);
    expect(result.results[0]!.isCorrect).toBe(false);
    expect(result.results[0]!.correctOptionId).toBe(correctOption.id);

    const stored = await testPrisma.quizAnswer.findFirstOrThrow({ where: { attemptId: attempt.attemptId } });
    expect(stored.isCorrect).toBe(false); // the persisted row matches the real grading, not the tampered claim

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });
});

describe("deadline extension arithmetic across a suspension (rule 8/9)", () => {
  it("shifts only deadlines whose dueAt fell inside the suspension window, by exactly its length, leaving originalDueAt untouched", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intakeStart = new Date("2026-01-12T00:00:00Z");
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "IN_PROGRESS", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: intakeStart },
    });
    // Two modules — week 1 (releases at intake start, inside the
    // suspension window below) and week 5 (releases four weeks later,
    // outside the window) — so the test can assert one shifts and the
    // other doesn't.
    await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 5, title: "Week 5", orderIndex: 1 } });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    const created = await generateDeadlinesForEnrolment(enrolment.id, testPrisma);
    expect(created).toBe(2); // one LECTURE_RELEASE per module, no drafting/quiz authored

    const week1Deadline = await testPrisma.deadline.findFirstOrThrow({ where: { enrolmentId: enrolment.id, dueAt: intakeStart } });
    const originalDueAt = week1Deadline.dueAt;
    const originalOriginalDueAt = week1Deadline.originalDueAt;

    const suspendedFrom = new Date("2026-01-10T00:00:00Z");
    const suspendedTo = new Date("2026-01-19T00:00:00Z"); // 9-day suspension, covers week 1's release but not week 5's (2026-02-09)
    const suspensionMs = suspendedTo.getTime() - suspendedFrom.getTime();

    const extendedCount = await extendDeadlinesForSuspension({ candidateId: candidate.id, from: suspendedFrom, to: suspendedTo }, testPrisma);
    expect(extendedCount).toBe(1);

    const afterWeek1 = await testPrisma.deadline.findUniqueOrThrow({ where: { id: week1Deadline.id } });
    expect(afterWeek1.dueAt.getTime()).toBe(originalDueAt.getTime() + suspensionMs); // shifted by exactly the suspension length
    expect(afterWeek1.originalDueAt.getTime()).toBe(originalOriginalDueAt.getTime()); // never mutated
    expect(afterWeek1.extendedReason).toContain("9 day");

    const week5Deadline = await testPrisma.deadline.findFirstOrThrow({ where: { enrolmentId: enrolment.id, NOT: { id: week1Deadline.id } } });
    expect(week5Deadline.extendedReason).toBeNull(); // outside the window — untouched
    expect(week5Deadline.dueAt.getTime()).toBe(week5Deadline.originalDueAt.getTime());

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });
});

describe("resume position after an abrupt disconnect", () => {
  it("the last successful position save is what a fresh page load resumes from", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "APRIL", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 0, title: "Video Lecture", mediaKind: "VIDEO" } });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    // A throttled save while playing, then an abrupt disconnect — no
    // "session ended cleanly" save ever runs, only this last one.
    await savePosition(candidate.id, enrolment.id, lecture.id, { mediaPositionSeconds: 42 });
    await savePosition(candidate.id, enrolment.id, lecture.id, { mediaPositionSeconds: 187 });

    const resumed = await testPrisma.lectureProgress.findUniqueOrThrow({
      where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture.id } },
    });
    expect(resumed.mediaPositionSeconds).toBe(187);
    expect(resumed.state).toBe("IN_PROGRESS"); // a position save alone never completes the lecture

    // A candidate who never owned this enrolment can't write to it —
    // proves the resume path is scoped, not just "whoever has the URL".
    const stranger = await testPrisma.candidate.create({
      data: {
        applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
        firstName: "Stranger",
        lastName: "Candidate",
        email: `player-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    await expect(savePosition(stranger.id, enrolment.id, lecture.id, { mediaPositionSeconds: 999 })).rejects.toThrow();
    await testPrisma.candidate.delete({ where: { id: stranger.id } });

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
