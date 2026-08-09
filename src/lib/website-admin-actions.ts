import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as marking-actions.ts / exam-builder-actions.ts. staffId is
// always passed in by the caller (a "use server" Action that already
// checked the permission), which keeps this file importable from plain
// Vitest tests.

export class ListingNotFoundError extends Error {
  constructor() {
    super("That programme has no listing yet.");
    this.name = "ListingNotFoundError";
  }
}

export interface UpsertListingInput {
  useDefaults: boolean;
  headline?: string | null;
  summary?: string | null;
  outcomes?: string[]; // empty array, not null, clears the list — Json? fields reject a bare null here
  includes?: string[];
  assessmentNote?: string | null;
  paymentNote?: string | null;
}

export async function upsertListing(programmeId: string, input: UpsertListingInput) {
  const { outcomes, includes, ...rest } = input;
  const data = { ...rest, ...(outcomes ? { outcomes } : {}), ...(includes ? { includes } : {}) };
  return prisma.programmeListing.upsert({
    where: { programmeId },
    create: { programmeId, ...data },
    update: data,
  });
}

export interface PublishCheckFailure {
  reason: string;
}

/**
 * The four pre-publish checks, named individually (README) rather than
 * a single boolean — the admin UI lists exactly what's wrong.
 */
export async function checkPublishable(programmeId: string): Promise<PublishCheckFailure[]> {
  const [programme, listing] = await Promise.all([
    prisma.programme.findUniqueOrThrow({
      where: { id: programmeId },
      include: { modules: { include: { lectures: { select: { id: true } } } } },
    }),
    prisma.programmeListing.findUnique({ where: { programmeId } }),
  ]);

  const failures: PublishCheckFailure[] = [];

  if (programme.status !== "ACTIVE") {
    failures.push({ reason: `The programme is ${programme.status === "DRAFT" ? "still a draft" : "archived"}, not active for enrolment.` });
  }
  const hasLecture = programme.modules.some((m) => m.lectures.length > 0);
  if (!hasLecture) {
    failures.push({ reason: "The programme has no module with at least one lecture yet." });
  }
  if (programme.feeMinor <= 0) {
    failures.push({ reason: "The programme fee is ₦0. Set a fee before publishing." });
  }
  if (listing && !listing.useDefaults) {
    const missing: string[] = [];
    if (!listing.headline?.trim()) missing.push("headline");
    if (!listing.summary?.trim()) missing.push("summary");
    if (!listing.outcomes || (listing.outcomes as string[]).length === 0) missing.push("outcomes");
    if (!listing.includes || (listing.includes as string[]).length === 0) missing.push("what enrolment includes");
    if (missing.length > 0) {
      failures.push({ reason: `Custom copy is missing: ${missing.join(", ")}.` });
    }
  }

  return failures;
}

export class PublishCheckError extends Error {
  failures: PublishCheckFailure[];
  constructor(failures: PublishCheckFailure[]) {
    super(failures.map((f) => f.reason).join(" "));
    this.name = "PublishCheckError";
    this.failures = failures;
  }
}

export async function publishListing(programmeId: string, actingStaffId: string) {
  const failures = await checkPublishable(programmeId);
  if (failures.length > 0) throw new PublishCheckError(failures);

  const programme = await prisma.programme.findUniqueOrThrow({ where: { id: programmeId }, select: { title: true } });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // upsert, not update — a programme published straight from its
    // useDefaults state may never have had a Save click, so no row
    // exists yet; that's fine, defaults are exactly what publishing on
    // a bare programme should mean.
    const listing = await tx.programmeListing.upsert({
      where: { programmeId },
      create: { programmeId, isPublished: true, publishedAt: now, publishedByStaffId: actingStaffId },
      update: { isPublished: true, publishedAt: now, publishedByStaffId: actingStaffId, unpublishedAt: null },
    });
    await recordAuditEvent(tx, {
      actorStaffId: actingStaffId,
      subjectType: "programme_listing",
      subjectId: listing.id,
      action: "listing.published",
      description: `Published the ${programme.title} listing to the website`,
    });
  });
}

/** Never touches enrolment (rule 5) — a programme pulled from the site stays open to enrolled candidates. */
export async function unpublishListing(programmeId: string, reason: string, actingStaffId: string) {
  const listing = await prisma.programmeListing.findUnique({ where: { programmeId }, include: { programme: { select: { title: true } } } });
  if (!listing) throw new ListingNotFoundError();

  await prisma.$transaction(async (tx) => {
    await tx.programmeListing.update({
      where: { programmeId },
      data: { isPublished: false, unpublishedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorStaffId: actingStaffId,
      subjectType: "programme_listing",
      subjectId: listing.id,
      action: "listing.unpublished",
      description: `Unpublished the ${listing.programme.title} listing`,
      reason,
    });
  });
}

export async function reorderListings(orderedProgrammeIds: string[]) {
  await prisma.$transaction(
    orderedProgrammeIds.map((programmeId, index) =>
      prisma.programmeListing.update({ where: { programmeId }, data: { orderIndex: index } })
    )
  );
}
