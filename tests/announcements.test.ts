import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { composeAnnouncement, sendAnnouncement, withdrawAnnouncement, AlreadySentError } from "@/lib/announcements";

async function seedStaffProgrammeIntake() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Announcement Staff", email: `announce-test-${crypto.randomUUID()}@example.com`, role: "REGISTRAR", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Announce Test Category ${crypto.randomUUID()}`, slug: `announce-test-${crypto.randomUUID()}` },
  });
  const programme = await testPrisma.programme.create({
    data: {
      code: `ANN-${crypto.randomUUID().slice(0, 8)}`,
      title: "Announcement Test Programme",
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
  return { staff, category, programme, intake };
}

async function seedCandidate(suffix: string) {
  return testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      firstName: "Test",
      lastName: suffix,
      email: `announce-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
}

async function cleanup(opts: { candidateIds: string[]; programmeId: string; categoryId: string; staffId: string; intakeId: string; announcementIds: string[] }) {
  await testPrisma.announcementDelivery.deleteMany({ where: { announcementId: { in: opts.announcementIds } } });
  // audit_event rows are never deleted (rule 5) — left in place, harmless test debris.
  await testPrisma.announcement.deleteMany({ where: { id: { in: opts.announcementIds } } });
  await testPrisma.enrolment.deleteMany({ where: { candidateId: { in: opts.candidateIds } } });
  await testPrisma.candidate.deleteMany({ where: { id: { in: opts.candidateIds } } });
  await testPrisma.programme.delete({ where: { id: opts.programmeId } });
  await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  await testPrisma.staff.delete({ where: { id: opts.staffId } });
  await testPrisma.intake.delete({ where: { id: opts.intakeId } });
}

describe("announcement audience is resolved once and frozen at send (rule 8)", () => {
  it("a candidate who enrols AFTER send never appears among the delivery rows for that announcement", async () => {
    const { staff, category, programme, intake } = await seedStaffProgrammeIntake();
    const enrolled = await seedCandidate("Enrolled");
    const laterEnrolled = await seedCandidate("LaterEnrolled");
    await testPrisma.enrolment.create({
      data: { candidateId: enrolled.id, programmeId: programme.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() },
    });

    const announcement = await composeAnnouncement({
      staffId: staff.id,
      title: "Test announcement",
      body: "Body",
      // Scoped to this test's own programme — otherwise "ENROLLED" would
      // match every other enrolled candidate in the shared dev database.
      audienceFilter: { enrolmentStatus: "ENROLLED", programmeId: programme.id },
      channels: ["IN_APP"],
    });
    const { recipientCount } = await sendAnnouncement(announcement.id, staff.id);
    expect(recipientCount).toBe(1);

    // Now the second candidate enrols — AFTER the send.
    await testPrisma.enrolment.create({
      data: { candidateId: laterEnrolled.id, programmeId: programme.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() },
    });

    const deliveries = await testPrisma.announcementDelivery.findMany({ where: { announcementId: announcement.id } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.candidateId).toBe(enrolled.id);
    expect(deliveries.some((d) => d.candidateId === laterEnrolled.id)).toBe(false);

    const sent = await testPrisma.announcement.findUniqueOrThrow({ where: { id: announcement.id } });
    expect(sent.recipientCount).toBe(1); // the stored summary also stays frozen, not re-derived on read

    await cleanup({
      candidateIds: [enrolled.id, laterEnrolled.id],
      programmeId: programme.id,
      categoryId: category.id,
      staffId: staff.id,
      intakeId: intake.id,
      announcementIds: [announcement.id],
    });
  });

  it("one delivery row per recipient PER CHANNEL — two channels on one recipient is two rows", async () => {
    const { staff, category, programme, intake } = await seedStaffProgrammeIntake();
    const candidate = await seedCandidate("TwoChannel");
    await testPrisma.enrolment.create({
      data: { candidateId: candidate.id, programmeId: programme.id, intakeId: intake.id, status: "ACTIVE", enrolledAt: new Date() },
    });

    const announcement = await composeAnnouncement({
      staffId: staff.id,
      title: "Two channel test",
      body: "Body",
      audienceFilter: { enrolmentStatus: "ENROLLED", programmeId: programme.id },
      channels: ["IN_APP", "EMAIL"],
    });
    await sendAnnouncement(announcement.id, staff.id);

    const deliveries = await testPrisma.announcementDelivery.findMany({ where: { announcementId: announcement.id } });
    expect(deliveries).toHaveLength(2);
    expect(new Set(deliveries.map((d) => d.channel))).toEqual(new Set(["IN_APP", "EMAIL"]));

    await cleanup({
      candidateIds: [candidate.id],
      programmeId: programme.id,
      categoryId: category.id,
      staffId: staff.id,
      intakeId: intake.id,
      announcementIds: [announcement.id],
    });
  });
});

describe("withdrawal timing (rule 8: only before send)", () => {
  it("a DRAFT announcement can be withdrawn", async () => {
    const { staff, category, programme, intake } = await seedStaffProgrammeIntake();
    const announcement = await composeAnnouncement({
      staffId: staff.id,
      title: "Draft to withdraw",
      body: "Body",
      audienceFilter: { enrolmentStatus: "ALL" },
      channels: ["IN_APP"],
    });
    await withdrawAnnouncement(announcement.id, staff.id);
    const withdrawn = await testPrisma.announcement.findUniqueOrThrow({ where: { id: announcement.id } });
    expect(withdrawn.state).toBe("WITHDRAWN");

    await cleanup({ candidateIds: [], programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id, announcementIds: [announcement.id] });
  });

  it("a SENT announcement cannot be withdrawn", async () => {
    const { staff, category, programme, intake } = await seedStaffProgrammeIntake();
    const announcement = await composeAnnouncement({
      staffId: staff.id,
      title: "Already sent",
      body: "Body",
      audienceFilter: { enrolmentStatus: "ALL" },
      channels: ["IN_APP"],
    });
    await sendAnnouncement(announcement.id, staff.id);
    await expect(withdrawAnnouncement(announcement.id, staff.id)).rejects.toThrow(AlreadySentError);

    await cleanup({ candidateIds: [], programmeId: programme.id, categoryId: category.id, staffId: staff.id, intakeId: intake.id, announcementIds: [announcement.id] });
  });
});
