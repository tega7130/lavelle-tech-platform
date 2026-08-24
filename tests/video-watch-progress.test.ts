import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { recordVideoWatchProgress, NotYourEnrolmentError } from "@/lib/player-actions";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Video Staff", email: `video-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Video Test Category ${crypto.randomUUID()}`, slug: `video-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function seedProgramme(staffId: string, categoryId: string) {
  return testPrisma.programme.create({
    data: {
      code: `VID-${crypto.randomUUID().slice(0, 8)}`,
      title: "Video Test Programme",
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
      firstName: "Video",
      lastName: "Candidate",
      email: `video-test-${crypto.randomUUID()}@example.com`,
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
    await testPrisma.videoWatchProgress.deleteMany({ where: { enrolment: { candidateId: opts.candidateId } } });
    await testPrisma.enrolment.deleteMany({ where: { candidateId: opts.candidateId } });
    await testPrisma.candidate.delete({ where: { id: opts.candidateId } });
  }
  if (opts.programmeId) await testPrisma.programme.delete({ where: { id: opts.programmeId } });
  if (opts.categoryId) await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  if (opts.staffId) await testPrisma.staff.delete({ where: { id: opts.staffId } });
  if (opts.intakeId) await testPrisma.intake.delete({ where: { id: opts.intakeId } });
}

describe("recordVideoWatchProgress — engagement tracking, distinct from the resume cursor", () => {
  it("creates a row on first report, and a rewind never decreases maxPositionSeconds", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 0, title: "Video Lecture", mediaKind: "VIDEO" } });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    await recordVideoWatchProgress(candidate.id, enrolment.id, lecture.id, { positionSeconds: 30 });
    let row = await testPrisma.videoWatchProgress.findUniqueOrThrow({ where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture.id } } });
    expect(row.maxPositionSeconds).toBe(30);

    // Further ahead — advances.
    await recordVideoWatchProgress(candidate.id, enrolment.id, lecture.id, { positionSeconds: 90 });
    row = await testPrisma.videoWatchProgress.findUniqueOrThrow({ where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture.id } } });
    expect(row.maxPositionSeconds).toBe(90);

    // A rewind (candidate scrubs back to 40s) must not undercount how far they actually got.
    await recordVideoWatchProgress(candidate.id, enrolment.id, lecture.id, { positionSeconds: 40 });
    row = await testPrisma.videoWatchProgress.findUniqueOrThrow({ where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture.id } } });
    expect(row.maxPositionSeconds).toBe(90);

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("first-report-wins on Lecture.durationSeconds — a later report never overwrites it", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "APRIL", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({
      data: { moduleId: mod.id, orderIndex: 0, title: "YouTube Lecture", mediaKind: "VIDEO", videoUrl: "https://youtu.be/dQw4w9WgXcQ" },
    });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    await recordVideoWatchProgress(candidate.id, enrolment.id, lecture.id, { positionSeconds: 10, durationSeconds: 600 });
    let updatedLecture = await testPrisma.lecture.findUniqueOrThrow({ where: { id: lecture.id } });
    expect(updatedLecture.durationSeconds).toBe(600);

    // A later, differing duration report (e.g. a slightly-off client read) never overwrites the first.
    await recordVideoWatchProgress(candidate.id, enrolment.id, lecture.id, { positionSeconds: 20, durationSeconds: 601 });
    updatedLecture = await testPrisma.lecture.findUniqueOrThrow({ where: { id: lecture.id } });
    expect(updatedLecture.durationSeconds).toBe(600);

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("rejects a candidate who doesn't own the enrolment", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "SEPTEMBER", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 0, title: "Video Lecture", mediaKind: "VIDEO" } });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    const stranger = await testPrisma.candidate.create({
      data: {
        applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
        firstName: "Stranger",
        lastName: "Candidate",
        email: `video-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    await expect(recordVideoWatchProgress(stranger.id, enrolment.id, lecture.id, { positionSeconds: 10 })).rejects.toThrow(NotYourEnrolmentError);
    await testPrisma.candidate.delete({ where: { id: stranger.id } });

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("is a no-op for a non-VIDEO lecture — the position-save payload sends mediaPositionSeconds (defaulting to 0) for every lecture kind, not just video", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    // A SLIDE lecture, not VIDEO — this is exactly what the candidate
    // player's "Introduction" slide lecture looked like when the bug
    // this test guards against was caught live.
    const lecture = await testPrisma.lecture.create({ data: { moduleId: mod.id, orderIndex: 0, title: "Slide Lecture", mediaKind: "SLIDES" } });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    const result = await recordVideoWatchProgress(candidate.id, enrolment.id, lecture.id, { positionSeconds: 0 });
    expect(result).toBeNull();

    const row = await testPrisma.videoWatchProgress.findUnique({ where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture.id } } });
    expect(row).toBeNull();

    await cleanup({ candidateId: candidate.id, programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
