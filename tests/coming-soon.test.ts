import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { markComingSoon, unmarkComingSoon, publishListing } from "@/lib/website-admin-actions";
import { getPublishedListings, getListingDetail } from "@/lib/website-reads";
import { assertProgrammeOpenForEnrolment, ProgrammeComingSoonError, ProgrammeNotOpenError } from "@/lib/payment-errors";
import { subscribeToProgrammeNotification, unsubscribeFromProgrammeNotification } from "@/lib/programme-notifications";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Coming Soon Staff", email: `coming-soon-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Coming Soon Test Category ${crypto.randomUUID()}`, slug: `coming-soon-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function seedPublishableProgramme(categoryId: string, staffId: string) {
  const programme = await testPrisma.programme.create({
    data: {
      code: `CS-${crypto.randomUUID().slice(0, 8)}`,
      title: "Coming Soon Test Programme",
      categoryId,
      tier: "SPECIALIST",
      status: "ACTIVE",
      summary: "A test programme for the Coming Soon feature.",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      feeMinor: 45_000_000,
      createdByStaffId: staffId,
    },
  });
  const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1: Foundations", orderIndex: 0 } });
  await testPrisma.lecture.create({
    data: { moduleId: mod.id, orderIndex: 0, title: "Introduction", mediaKind: "VIDEO", videoUrl: "https://videos.example.com/intro.mp4" },
  });
  return programme;
}

async function cleanupProgramme(programmeId: string) {
  await testPrisma.programmeNotificationSubscription.deleteMany({ where: { listing: { programmeId } } });
  await testPrisma.module.deleteMany({ where: { programmeId } });
  await testPrisma.programmeListing.deleteMany({ where: { programmeId } });
  await testPrisma.programme.delete({ where: { id: programmeId } });
}

async function cleanupRoot(opts: { categoryId: string; staffId: string }) {
  await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  await testPrisma.staff.delete({ where: { id: opts.staffId } });
}

describe("markComingSoon / unmarkComingSoon", () => {
  it("flips isComingSoon and comingSoonMessage, recording an audit event for each transition", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await publishListing(programme.id, staff.id);

    await markComingSoon(programme.id, "Launching Q1 2027", staff.id);
    const marked = await testPrisma.programmeListing.findUniqueOrThrow({ where: { programmeId: programme.id } });
    expect(marked.isComingSoon).toBe(true);
    expect(marked.comingSoonMessage).toBe("Launching Q1 2027");

    const markEvent = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "programme_listing", subjectId: marked.id, action: "listing.marked_coming_soon" },
      orderBy: { createdAt: "desc" },
    });
    expect(markEvent).not.toBeNull();

    await unmarkComingSoon(programme.id, staff.id);
    const unmarked = await testPrisma.programmeListing.findUniqueOrThrow({ where: { programmeId: programme.id } });
    expect(unmarked.isComingSoon).toBe(false);
    expect(unmarked.comingSoonMessage).toBeNull();

    const unmarkEvent = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "programme_listing", subjectId: marked.id, action: "listing.unmarked_coming_soon" },
      orderBy: { createdAt: "desc" },
    });
    expect(unmarkEvent).not.toBeNull();

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("throws ListingNotFoundError for a programme with no listing yet", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    // Deliberately never published, so no ProgrammeListing row exists.

    await expect(markComingSoon(programme.id, null, staff.id)).rejects.toThrow("That programme has no listing yet.");

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("public reads hide the fee for Coming Soon listings", () => {
  it("getPublishedListings includes a Coming Soon listing but with fee: null and the message surfaced", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await publishListing(programme.id, staff.id);
    await markComingSoon(programme.id, "Almost ready", staff.id);

    const listings = await getPublishedListings();
    const row = listings.find((l) => l.code === programme.code);
    expect(row).toBeDefined();
    expect(row!.isComingSoon).toBe(true);
    expect(row!.comingSoonMessage).toBe("Almost ready");
    expect(row!.fee).toBeNull();

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("getListingDetail hides fee and feeNote once Coming Soon, and clears both once open again", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await publishListing(programme.id, staff.id);
    await markComingSoon(programme.id, "Almost ready", staff.id);

    const comingSoonDetail = await getListingDetail(programme.code);
    expect(comingSoonDetail).not.toBeNull();
    expect(comingSoonDetail!.isComingSoon).toBe(true);
    expect(comingSoonDetail!.fee).toBeNull();
    expect(comingSoonDetail!.feeNote).toBeNull();
    expect(comingSoonDetail!.comingSoonMessage).toBe("Almost ready");

    await unmarkComingSoon(programme.id, staff.id);
    const liveDetail = await getListingDetail(programme.code);
    expect(liveDetail!.isComingSoon).toBe(false);
    expect(liveDetail!.fee).not.toBeNull();
    expect(liveDetail!.comingSoonMessage).toBeNull();

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("assertProgrammeOpenForEnrolment refuses a Coming Soon programme server-side", () => {
  it("throws ProgrammeComingSoonError even when the programme itself is ACTIVE", () => {
    expect(() => assertProgrammeOpenForEnrolment({ status: "ACTIVE", listing: { isComingSoon: true } })).toThrow(ProgrammeComingSoonError);
  });

  it("still throws ProgrammeNotOpenError for a non-ACTIVE programme, and passes a normal ACTIVE + non-Coming-Soon programme", () => {
    expect(() => assertProgrammeOpenForEnrolment({ status: "DRAFT", listing: null })).toThrow(ProgrammeNotOpenError);
    expect(() => assertProgrammeOpenForEnrolment({ status: "ACTIVE", listing: { isComingSoon: false } })).not.toThrow();
    expect(() => assertProgrammeOpenForEnrolment({ status: "ACTIVE", listing: null })).not.toThrow();
  });
});

describe("Coming Soon notification subscriptions", () => {
  it("subscribes, is idempotent on a repeat email, and resubscribes cleanly after unsubscribing", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await publishListing(programme.id, staff.id);
    await markComingSoon(programme.id, null, staff.id);
    const listing = await testPrisma.programmeListing.findUniqueOrThrow({ where: { programmeId: programme.id } });

    const email = `notify-test-${crypto.randomUUID()}@example.com`;
    await subscribeToProgrammeNotification(listing.id, email);
    const rows = await testPrisma.programmeNotificationSubscription.findMany({ where: { listingId: listing.id, email } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.unsubscribedAt).toBeNull();

    // Repeat submission is a no-op, not a duplicate row or a thrown error.
    await subscribeToProgrammeNotification(listing.id, email);
    const stillOne = await testPrisma.programmeNotificationSubscription.findMany({ where: { listingId: listing.id, email } });
    expect(stillOne).toHaveLength(1);

    await unsubscribeFromProgrammeNotification(rows[0]!.id);
    const unsubscribed = await testPrisma.programmeNotificationSubscription.findUniqueOrThrow({ where: { id: rows[0]!.id } });
    expect(unsubscribed.unsubscribedAt).not.toBeNull();

    // Subscribing again after unsubscribing clears unsubscribedAt on the same row rather than erroring.
    await subscribeToProgrammeNotification(listing.id, email);
    const resubscribed = await testPrisma.programmeNotificationSubscription.findUniqueOrThrow({ where: { id: rows[0]!.id } });
    expect(resubscribed.unsubscribedAt).toBeNull();

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("normalizes email case so the same address can't be subscribed twice under different casing", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedPublishableProgramme(category.id, staff.id);
    await publishListing(programme.id, staff.id);
    await markComingSoon(programme.id, null, staff.id);
    const listing = await testPrisma.programmeListing.findUniqueOrThrow({ where: { programmeId: programme.id } });

    const email = `Case-Test-${crypto.randomUUID()}@Example.com`;
    await subscribeToProgrammeNotification(listing.id, email);
    await subscribeToProgrammeNotification(listing.id, email.toUpperCase());
    const rows = await testPrisma.programmeNotificationSubscription.findMany({ where: { listingId: listing.id } });
    expect(rows).toHaveLength(1);

    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});
