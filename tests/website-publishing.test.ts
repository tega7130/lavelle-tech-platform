import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { checkPublishable, publishListing, unpublishListing, upsertListing, PublishCheckError } from "@/lib/website-admin-actions";
import { getPublishedListings, getListingDetail } from "@/lib/website-reads";
import { submitEnquiryCore } from "@/lib/enquiry";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Website Staff", email: `web-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Website Test Category ${crypto.randomUUID()}`, slug: `web-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

/** A programme that already passes all four publish checks — the baseline every test starts from or deviates from. */
async function seedPublishableProgramme(categoryId: string, staffId: string, overrides: Partial<{ status: "DRAFT" | "ACTIVE" | "ARCHIVED"; feeMinor: number }> = {}) {
  const programme = await testPrisma.programme.create({
    data: {
      code: `WEB-${crypto.randomUUID().slice(0, 8)}`,
      title: "Website Test Programme",
      categoryId,
      tier: "SPECIALIST",
      status: overrides.status ?? "ACTIVE",
      summary: "A test programme for website publishing checks.",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      credits: 24,
      feeMinor: overrides.feeMinor ?? 45_000_000,
      createdByStaffId: staffId,
    },
  });
  return programme;
}

async function seedModuleWithLecture(programmeId: string, opts: { videoUrl?: string } = {}) {
  const mod = await testPrisma.module.create({ data: { programmeId, weekNumber: 1, title: "Week 1: Foundations", orderIndex: 0 } });
  const lecture = await testPrisma.lecture.create({
    data: {
      moduleId: mod.id,
      orderIndex: 0,
      title: "Introduction to the subject",
      mediaKind: "VIDEO",
      videoUrl: opts.videoUrl ?? "https://videos.example.com/secret-lecture.mp4",
    },
  });
  return { mod, lecture };
}

async function seedAssessmentWeightings(programmeId: string) {
  await testPrisma.assessmentWeighting.createMany({
    data: [
      { programmeId, kind: "QUIZ", weightPercent: 20 },
      { programmeId, kind: "DRAFTING", weightPercent: 40 },
      { programmeId, kind: "EXAMINATION", weightPercent: 40 },
    ],
  });
}

async function cleanupProgramme(programmeId: string) {
  await testPrisma.assessmentWeighting.deleteMany({ where: { programmeId } });
  await testPrisma.module.deleteMany({ where: { programmeId } });
  await testPrisma.programmeListing.deleteMany({ where: { programmeId } });
  await testPrisma.programme.delete({ where: { id: programmeId } });
}

async function cleanupRoot(opts: { categoryId: string; staffId: string }) {
  await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  await testPrisma.staff.delete({ where: { id: opts.staffId } });
}

describe("checkPublishable — the four pre-publish checks", () => {
  it("passes a programme that is active, has a lecture, has a fee, and uses defaults", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await seedModuleWithLecture(programme.id);

    const failures = await checkPublishable(programme.id);
    expect(failures).toEqual([]);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("fails a DRAFT or ARCHIVED programme — enrolment status gates publishing", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id, { status: "DRAFT" });
    await seedModuleWithLecture(programme.id);

    const failures = await checkPublishable(programme.id);
    expect(failures.some((f) => f.reason.includes("still a draft"))).toBe(true);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("fails a programme with no module carrying a lecture", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    // No module/lecture seeded.

    const failures = await checkPublishable(programme.id);
    expect(failures.some((f) => f.reason.includes("no module with at least one lecture"))).toBe(true);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("fails a programme with a zero fee", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id, { feeMinor: 0 });
    await seedModuleWithLecture(programme.id);

    const failures = await checkPublishable(programme.id);
    expect(failures.some((f) => f.reason.includes("₦0"))).toBe(true);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("fails custom copy that is missing a headline, summary, outcomes or includes", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await seedModuleWithLecture(programme.id);
    await upsertListing(programme.id, { useDefaults: false }); // no headline/summary/outcomes/includes supplied

    const failures = await checkPublishable(programme.id);
    expect(failures.some((f) => f.reason.startsWith("Custom copy is missing"))).toBe(true);
    expect(failures.some((f) => f.reason.includes("headline"))).toBe(true);
    expect(failures.some((f) => f.reason.includes("summary"))).toBe(true);
    expect(failures.some((f) => f.reason.includes("outcomes"))).toBe(true);
    expect(failures.some((f) => f.reason.includes("what enrolment includes"))).toBe(true);

    // Filling everything in clears the failure.
    await upsertListing(programme.id, {
      useDefaults: false,
      headline: "Custom headline",
      summary: "Custom summary",
      outcomes: ["Do a thing"],
      includes: ["Access to the portal"],
    });
    const cleared = await checkPublishable(programme.id);
    expect(cleared.some((f) => f.reason.startsWith("Custom copy is missing"))).toBe(false);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("publishListing refuses to publish (throws PublishCheckError) when any check fails", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id, { status: "DRAFT" });
    await seedModuleWithLecture(programme.id);

    await expect(publishListing(programme.id, staff.id)).rejects.toThrow(PublishCheckError);
    const listing = await testPrisma.programmeListing.findUnique({ where: { programmeId: programme.id } });
    expect(listing).toBeNull(); // no half-published row left behind

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("unpublishListing — never touches enrolment (rule 5)", () => {
  it("leaves an existing enrolment completely intact, only flips the listing's own flags", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await seedModuleWithLecture(programme.id);
    await publishListing(programme.id, staff.id);

    const candidate = await testPrisma.candidate.create({
      data: {
        applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
        candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
        firstName: "Chidinma",
        lastName: "Eze",
        email: `web-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    const intake = await testPrisma.intake.create({
      data: {
        month: "SEPTEMBER",
        year: 2099,
        enrolmentOpensAt: new Date(),
        enrolmentClosesAt: new Date(Date.now() + 30 * 86_400_000),
        startsAt: new Date(Date.now() + 40 * 86_400_000),
      },
    });
    const enrolment = await testPrisma.enrolment.create({
      data: {
        candidateId: candidate.id,
        programmeId: programme.id,
        intakeId: intake.id,
        status: "ACTIVE",
        enrolledAt: new Date(),
      },
    });

    await unpublishListing(programme.id, "Refreshing the copy before relaunch", staff.id);

    const listingAfter = await testPrisma.programmeListing.findUniqueOrThrow({ where: { programmeId: programme.id } });
    expect(listingAfter.isPublished).toBe(false);
    expect(listingAfter.unpublishedAt).not.toBeNull();

    // The enrolment itself: same status, same row, untouched.
    const enrolmentAfter = await testPrisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } });
    expect(enrolmentAfter.status).toBe("ACTIVE");
    expect(enrolmentAfter.enrolledAt).toEqual(enrolment.enrolledAt);
    expect(enrolmentAfter.withdrawnAt).toBeNull();

    // Unpublishing without a reason is not allowed at the schema/API
    // boundary — the reason is mandatory on the audit event.
    const auditEvent = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "programme_listing", subjectId: listingAfter.id, action: "listing.unpublished" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditEvent?.reason).toBe("Refreshing the copy before relaunch");

    await testPrisma.enrolment.delete({ where: { id: enrolment.id } });
    await testPrisma.intake.delete({ where: { id: intake.id } });
    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("defaults are computed, never copied (rule 2)", () => {
  it("a live fee change on the programme reaches getPublishedListings on the very next read, with no republish", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id, { feeMinor: 45_000_000 });
    await seedModuleWithLecture(programme.id);
    await publishListing(programme.id, staff.id); // useDefaults stays true — never overridden

    const before = await getPublishedListings();
    const rowBefore = before.find((l) => l.code === programme.code);
    expect(rowBefore?.fee).toBe("₦450,000");

    await testPrisma.programme.update({ where: { id: programme.id }, data: { feeMinor: 60_000_000 } });
    // No call to upsertListing/publishListing here — the point is the read alone picks it up.

    const after = await getPublishedListings();
    const rowAfter = after.find((l) => l.code === programme.code);
    expect(rowAfter?.fee).toBe("₦600,000");

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("getListingDetail — public payload excludes media URLs (rule 4)", () => {
  it("returns lecture titles and structure only, never a videoUrl or any other media/narration field", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await seedModuleWithLecture(programme.id, { videoUrl: "https://videos.example.com/should-never-leak.mp4" });
    await seedAssessmentWeightings(programme.id);
    await publishListing(programme.id, staff.id);

    const detail = await getListingDetail(programme.code);
    expect(detail).not.toBeNull();
    expect(detail!.modules).toHaveLength(1);
    expect(detail!.modules[0]!.lectures).toEqual(["Introduction to the subject"]);

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("videoUrl");
    expect(serialized).not.toContain("videos.example.com");
    expect(serialized).not.toContain("narrationAssetId");
    expect(serialized).not.toContain("slide");

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("returns null for a programme that has never been published, and for an unknown code", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await seedModuleWithLecture(programme.id);
    // Deliberately never published.

    expect(await getListingDetail(programme.code)).toBeNull();
    expect(await getListingDetail("NOT-A-REAL-CODE")).toBeNull();

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("submitEnquiryCore — an enquiry always becomes a support request (rule 8)", () => {
  it("creates a linked ContactEnquiry and a candidate-less SupportRequest with category ENQUIRY", async () => {
    const email = `enquiry-test-${crypto.randomUUID()}@example.com`;
    const result = await submitEnquiryCore(
      { name: "Uche Nnamdi", email, message: "Please tell me about the Advanced Litigation programme." },
      "203.0.113.55"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.reference).toMatch(/^LVL-ENQ-[A-F0-9]{8}$/);

    const enquiry = await testPrisma.contactEnquiry.findFirstOrThrow({ where: { email }, include: { supportRequest: true } });
    expect(enquiry.name).toBe("Uche Nnamdi");
    expect(enquiry.supportRequest).not.toBeNull();
    expect(enquiry.supportRequest!.candidateId).toBeNull(); // anonymous visitor, no candidate account
    expect(enquiry.supportRequest!.guestName).toBe("Uche Nnamdi");
    expect(enquiry.supportRequest!.guestEmail).toBe(email);
    expect(enquiry.supportRequest!.category).toBe("ENQUIRY");

    await testPrisma.contactEnquiry.delete({ where: { id: enquiry.id } });
    await testPrisma.supportRequest.delete({ where: { id: enquiry.supportRequestId! } });
  });

  it("rate-limits repeated enquiries from the same IP without ever throwing", async () => {
    const ip = `203.0.113.${crypto.randomInt(60, 254)}`;
    let sawRateLimit = false;
    const created: string[] = [];
    for (let i = 0; i < 8; i++) {
      const email = `enquiry-rl-${crypto.randomUUID()}@example.com`;
      const result = await submitEnquiryCore({ name: "Rate Test", email, message: `Attempt ${i}` }, ip);
      if (!result.ok) {
        sawRateLimit = true;
        expect(result.error).toBeTruthy();
        break;
      }
      created.push(email);
    }
    expect(sawRateLimit).toBe(true);

    await testPrisma.contactEnquiry.deleteMany({ where: { email: { in: created } }, });
    await testPrisma.supportRequest.deleteMany({ where: { guestEmail: { in: created } } });
  });
});
