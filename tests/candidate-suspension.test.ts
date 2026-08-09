import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { suspendCandidate, reactivateCandidate } from "@/lib/candidate-status";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Suspension Staff", email: `suspend-test-${crypto.randomUUID()}@example.com`, role: "REGISTRAR", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Suspend Test Category ${crypto.randomUUID()}`, slug: `suspend-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function cleanup(opts: { candidateId: string; programmeId: string; categoryId: string; staffId: string; intakeId: string }) {
  await testPrisma.deadline.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
  await testPrisma.lectureProgress.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
  await testPrisma.enrolment.deleteMany({ where: { candidateId: opts.candidateId } });
  // audit_event rows are never deleted (rule 5) — left in place, harmless test debris.
  await testPrisma.candidate.delete({ where: { id: opts.candidateId } });
  await testPrisma.programme.delete({ where: { id: opts.programmeId } });
  await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  await testPrisma.staff.delete({ where: { id: opts.staffId } });
  await testPrisma.intake.delete({ where: { id: opts.intakeId } });
}

describe("suspending a candidate preserves enrolment and progress rows (rule: suspension is not deletion)", () => {
  it("enrolment, lecture progress and deadlines all survive a suspend/reactivate cycle unchanged", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await testPrisma.programme.create({
      data: {
        code: `SUS-${crypto.randomUUID().slice(0, 8)}`,
        title: "Suspension Test Programme",
        categoryId: category.id,
        tier: "SPECIALIST",
        status: "ACTIVE",
        summary: "test",
        weeks: 12,
        weeklyHoursLabel: "6-8 hrs / week",
        credits: 24,
        feeMinor: 45_000_000,
        createdByStaffId: staff.id,
      },
    });
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({
      data: { moduleId: mod.id, orderIndex: 0, title: "Lecture 1", mediaKind: "VIDEO" },
    });
    const candidate = await testPrisma.candidate.create({
      data: {
        applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
        candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
        firstName: "Test",
        lastName: "Candidate",
        email: `suspend-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    const enrolment = await testPrisma.enrolment.create({
      data: { candidateId: candidate.id, programmeId: programme.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() },
    });
    await testPrisma.lectureProgress.create({
      data: { enrolmentId: enrolment.id, lectureId: lecture.id, state: "COMPLETED", stepsCompleted: ["content"], completedAt: new Date() },
    });
    const deadline = await testPrisma.deadline.create({
      data: {
        enrolmentId: enrolment.id,
        kind: "LECTURE_RELEASE",
        lectureId: lecture.id,
        title: "Lecture 1 deadline",
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        originalDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await suspendCandidate(candidate.id, staff.id, "Testing suspension preserves rows", null);

    const [survivedEnrolment, survivedProgress, survivedDeadline, suspended] = await Promise.all([
      testPrisma.enrolment.findUnique({ where: { id: enrolment.id } }),
      testPrisma.lectureProgress.findUnique({ where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture.id } } }),
      testPrisma.deadline.findUnique({ where: { id: deadline.id } }),
      testPrisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } }),
    ]);

    expect(survivedEnrolment).not.toBeNull();
    expect(survivedEnrolment?.status).toBe("ACTIVE"); // the enrolment itself is untouched — only the account is gated
    expect(survivedProgress).not.toBeNull();
    expect(survivedProgress?.state).toBe("COMPLETED");
    expect(survivedDeadline).not.toBeNull();
    expect(suspended.accountStatus).toBe("SUSPENDED");

    await reactivateCandidate(candidate.id, staff.id, null);
    const reactivated = await testPrisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(reactivated.accountStatus).toBe("ACTIVE");

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });
});
