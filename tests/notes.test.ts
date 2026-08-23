import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { saveLectureNote, deleteLectureNote, NotYourEnrolmentError } from "@/lib/player-actions";
import { getCandidateNotes } from "@/lib/notes-reads";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Notes Staff", email: `notes-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Notes Test Category ${crypto.randomUUID()}`, slug: `notes-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function seedProgramme(staffId: string, categoryId: string) {
  return testPrisma.programme.create({
    data: {
      code: `NTE-${crypto.randomUUID().slice(0, 8)}`,
      title: "Notes Test Programme",
      categoryId,
      tier: "SPECIALIST",
      status: "ACTIVE",
      summary: "test",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
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
      email: `notes-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
  const enrolment = await testPrisma.enrolment.create({
    data: { candidateId: candidate.id, programmeId, intakeId, status: "ACTIVE", enrolledAt: new Date() },
  });
  return { candidate, enrolment };
}

async function cleanup(opts: { candidateIds?: string[]; programmeId?: string; categoryId?: string; staffId?: string; intakeId?: string }) {
  for (const candidateId of opts.candidateIds ?? []) {
    await testPrisma.lectureNote.deleteMany({ where: { enrolment: { candidateId } } });
    await testPrisma.enrolment.deleteMany({ where: { candidateId } });
    await testPrisma.candidate.delete({ where: { id: candidateId } });
  }
  if (opts.programmeId) await testPrisma.programme.delete({ where: { id: opts.programmeId } });
  if (opts.categoryId) await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  if (opts.staffId) await testPrisma.staff.delete({ where: { id: opts.staffId } });
  if (opts.intakeId) await testPrisma.intake.delete({ where: { id: opts.intakeId } });
}

describe("saveLectureNote — upsert, ownership, delete", () => {
  it("creates then updates the same row on repeated saves (one note per lecture)", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "JANUARY", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({
      data: { moduleId: mod.id, orderIndex: 0, title: "Notes Lecture", mediaKind: "VIDEO" },
    });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    const first = await saveLectureNote(candidate.id, enrolment.id, lecture.id, "First draft");
    expect(first.body).toBe("First draft");

    const second = await saveLectureNote(candidate.id, enrolment.id, lecture.id, "**Revised** note");
    expect(second.id).toBe(first.id); // same row, upserted — not a second one
    expect(second.body).toBe("**Revised** note");

    const count = await testPrisma.lectureNote.count({ where: { enrolmentId: enrolment.id, lectureId: lecture.id } });
    expect(count).toBe(1);

    await cleanup({ candidateIds: [candidate.id], programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("rejects saving/deleting a note against someone else's enrolment", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "APRIL", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({
      data: { moduleId: mod.id, orderIndex: 0, title: "Ownership Lecture", mediaKind: "VIDEO" },
    });
    const { candidate: owner, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);
    const { candidate: intruder } = await seedCandidateAndEnrolment(programme.id, intake.id);

    await expect(saveLectureNote(intruder.id, enrolment.id, lecture.id, "Not yours")).rejects.toThrow(NotYourEnrolmentError);
    await expect(deleteLectureNote(intruder.id, enrolment.id, lecture.id)).rejects.toThrow(NotYourEnrolmentError);

    await cleanup({ candidateIds: [owner.id, intruder.id], programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });

  it("deletes the note and leaves nothing behind", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "SEPTEMBER", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lecture = await testPrisma.lecture.create({
      data: { moduleId: mod.id, orderIndex: 0, title: "Delete Lecture", mediaKind: "VIDEO" },
    });
    const { candidate, enrolment } = await seedCandidateAndEnrolment(programme.id, intake.id);

    await saveLectureNote(candidate.id, enrolment.id, lecture.id, "Temporary");
    await deleteLectureNote(candidate.id, enrolment.id, lecture.id);

    const row = await testPrisma.lectureNote.findUnique({ where: { enrolmentId_lectureId: { enrolmentId: enrolment.id, lectureId: lecture.id } } });
    expect(row).toBeNull();

    // Idempotent — deleting again (nothing left to delete) doesn't throw.
    await expect(deleteLectureNote(candidate.id, enrolment.id, lecture.id)).resolves.not.toThrow();

    await cleanup({ candidateIds: [candidate.id], programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id });
  });
});

describe("getCandidateNotes — grouped across every enrolment", () => {
  it("groups notes by programme, across two separate enrolments for the same candidate", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programmeA = await seedProgramme(staff.id, category.id);
    const programmeB = await seedProgramme(staff.id, category.id);
    const intake = await testPrisma.intake.create({
      data: { month: "APRIL", year: crypto.randomInt(10_000, 999_999), status: "OPEN", enrolmentOpensAt: new Date(), enrolmentClosesAt: new Date(), startsAt: new Date() },
    });
    const modA = await testPrisma.module.create({ data: { programmeId: programmeA.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lectureA = await testPrisma.lecture.create({ data: { moduleId: modA.id, orderIndex: 0, title: "Lecture A", mediaKind: "VIDEO" } });
    const modB = await testPrisma.module.create({ data: { programmeId: programmeB.id, weekNumber: 1, title: "Week 1", orderIndex: 0 } });
    const lectureB = await testPrisma.lecture.create({ data: { moduleId: modB.id, orderIndex: 0, title: "Lecture B", mediaKind: "VIDEO" } });

    const candidate = await testPrisma.candidate.create({
      data: {
        applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
        candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
        firstName: "Multi",
        lastName: "Enrolled",
        email: `notes-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    const enrolmentA = await testPrisma.enrolment.create({
      data: { candidateId: candidate.id, programmeId: programmeA.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() },
    });
    const enrolmentB = await testPrisma.enrolment.create({
      data: { candidateId: candidate.id, programmeId: programmeB.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() },
    });

    await saveLectureNote(candidate.id, enrolmentA.id, lectureA.id, "**Bold** note in programme A");
    await saveLectureNote(candidate.id, enrolmentB.id, lectureB.id, "Note in programme B");

    const groups = await getCandidateNotes(candidate.id);
    expect(groups).toHaveLength(2);

    const groupA = groups.find((g) => g.enrolmentId === enrolmentA.id);
    expect(groupA?.notes).toHaveLength(1);
    expect(groupA?.notes[0]?.lectureTitle).toBe("Lecture A");
    expect(groupA?.notes[0]?.preview).toBe("Bold note in programme A"); // markers stripped

    const groupB = groups.find((g) => g.enrolmentId === enrolmentB.id);
    expect(groupB?.notes).toHaveLength(1);
    expect(groupB?.notes[0]?.lectureTitle).toBe("Lecture B");

    // programmeB must be torn down before staff/category (it still FKs
    // both) — cleanup() below only ever handles one programme.
    await testPrisma.lectureNote.deleteMany({ where: { enrolment: { candidateId: candidate.id } } });
    await testPrisma.enrolment.deleteMany({ where: { candidateId: candidate.id } });
    await testPrisma.module.deleteMany({ where: { programmeId: programmeB.id } });
    await testPrisma.programme.delete({ where: { id: programmeB.id } });

    await cleanup({
      candidateIds: [candidate.id],
      programmeId: programmeA.id,
      categoryId: category.id,
      staffId: staff.id,
      intakeId: intake.id,
    });
  });

  it("returns an empty array for a candidate with no enrolments", async () => {
    const candidate = await testPrisma.candidate.create({
      data: {
        applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
        firstName: "No",
        lastName: "Enrolment",
        email: `notes-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });

    const groups = await getCandidateNotes(candidate.id);
    expect(groups).toEqual([]);

    await testPrisma.candidate.delete({ where: { id: candidate.id } });
  });
});
