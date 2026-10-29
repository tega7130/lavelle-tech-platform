import { prisma } from "@/lib/prisma";
import {
  Prisma,
  LawyerEntityType,
  LawyerWebsiteSectionKey,
  LawyerWebsiteVerificationStatus,
  LawyerQualificationSource,
  CertificateStatus,
} from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { p2002Target } from "@/lib/prisma-errors";
import {
  DEFAULT_TEMPLATE_KEY,
  DEFAULT_COLOR_THEME_KEY,
  DEFAULT_FONT_PAIRING_KEY,
  LAWYER_WEBSITE_TEMPLATES,
  LAWYER_WEBSITE_COLOR_THEMES,
  LAWYER_WEBSITE_FONT_PAIRINGS,
} from "@/lib/lawyer-website-templates";
import { RESERVED_LAWYER_HANDLES } from "@/lib/lawyer-website-reads";

// No "server-only" / session import here, deliberately — same discipline
// as blog-admin-actions.ts. candidateId is always passed in by the
// caller (a "use server" Action that already resolved the session),
// which keeps this file importable from plain Vitest tests.

// Bump this whenever the disclaimer text shown in the builder changes
// materially — Phase 4's publish gate re-checks this against the current
// value, so a candidate who acknowledged an earlier version must
// re-acknowledge before their next publish attempt.
export const CONDUCT_DISCLAIMER_VERSION = 1;

// Seeded once at site creation, in this display order — a lawyer
// hides/reorders sections by editing these rows later, never by adding
// or removing them.
const SECTION_ORDER: LawyerWebsiteSectionKey[] = [
  LawyerWebsiteSectionKey.ABOUT,
  LawyerWebsiteSectionKey.PRACTICE_AREAS,
  LawyerWebsiteSectionKey.QUALIFICATIONS,
  LawyerWebsiteSectionKey.EXPERIENCE,
  LawyerWebsiteSectionKey.PUBLICATIONS,
  LawyerWebsiteSectionKey.ACTIVITIES,
  LawyerWebsiteSectionKey.SOCIAL_CONTACT,
  LawyerWebsiteSectionKey.CV,
];

export function getLawyerWebsiteForCandidate(candidateId: string) {
  return prisma.lawyerWebsite.findUnique({
    where: { candidateId },
    include: {
      verification: true,
      sections: { orderBy: { orderIndex: "asc" } },
      qualifications: { orderBy: { orderIndex: "asc" } },
      experiences: { orderBy: { orderIndex: "asc" } },
      publications: { orderBy: { orderIndex: "asc" } },
      activities: { orderBy: { orderIndex: "asc" } },
    },
  });
}

export interface StartLawyerWebsiteInput {
  entityType: LawyerEntityType;
  firmName?: string | null;
}

/**
 * Creates the site, its section rows and its verification row (PENDING,
 * scnNumber pre-filled from CandidateProfile when the candidate already
 * has one on file) in one transaction. Handle is auto-suggested from the
 * candidate's name (INDIVIDUAL) or the firm name (LAW_FIRM), retried
 * with a numeric suffix on collision — same retry-on-conflict shape as
 * createBlogPost's slug.
 */
export async function startLawyerWebsite(candidateId: string, input: StartLawyerWebsiteInput) {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { profile: true },
  });

  const base =
    input.entityType === LawyerEntityType.LAW_FIRM
      ? slugify(input.firmName ?? "") || "firm"
      : slugify(`${candidate.firstName} ${candidate.lastName}`) || "lawyer";

  for (let attempt = 0; attempt < 5; attempt++) {
    const handle = attempt === 0 ? base : `${base}-${attempt + 1}`;
    // A reserved word (an existing or important future top-level route —
    // see RESERVED_LAWYER_HANDLES) is treated exactly like a real DB
    // collision: skip straight to the next numeric suffix, never write it.
    if (RESERVED_LAWYER_HANDLES.has(handle)) continue;
    try {
      return await prisma.$transaction(async (tx) => {
        const site = await tx.lawyerWebsite.create({
          data: {
            candidateId,
            entityType: input.entityType,
            firmName: input.entityType === LawyerEntityType.LAW_FIRM ? input.firmName?.trim() : null,
            handle,
            // attempt > 0 means the natural handle was already taken —
            // the builder UI surfaces this so the fallback is never silent.
            handleAutoSuffixedAt: attempt > 0 ? new Date() : null,
            practiceAreas: [],
            socialLinks: [],
            templateKey: DEFAULT_TEMPLATE_KEY,
            colorThemeKey: DEFAULT_COLOR_THEME_KEY,
            fontPairingKey: DEFAULT_FONT_PAIRING_KEY,
          },
        });
        await tx.lawyerWebsiteSection.createMany({
          data: SECTION_ORDER.map((sectionKey, i) => ({
            lawyerWebsiteId: site.id,
            sectionKey,
            orderIndex: i,
          })),
        });
        await tx.lawyerWebsiteVerification.create({
          data: {
            lawyerWebsiteId: site.id,
            scnNumber: candidate.profile?.scnNumber ?? null,
          },
        });
        await recordAuditEvent(tx, {
          subjectType: "lawyer_website",
          subjectId: site.id,
          action: "lawyer_website.created",
          description: `Started a ${input.entityType === LawyerEntityType.LAW_FIRM ? "law firm" : "personal"} website (handle: ${handle})`,
        });
        return site;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && p2002Target(e).includes("handle") && attempt < 4) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique website address. Please try again.");
}

export class HandleNotOwnNameError extends Error {
  constructor() {
    super("Your website address must be based on your own name.");
    this.name = "HandleNotOwnNameError";
  }
}

export class HandleTakenError extends Error {
  constructor() {
    super("That address is already taken. Please choose another.");
    this.name = "HandleTakenError";
  }
}

/**
 * True only if every one of the candidate's own name components (their
 * first and last name, or their firm name) appears somewhere in the
 * candidate handle — insertions (a middle initial, a numeral, a practice
 * location) are fine, but a handle unrelated to their real identity is
 * not. This is deliberately a substring check, not an exact match: it's
 * a soft, reasonable guard against impersonation and self-promotional
 * vanity handles (which the conduct disclaimer already prohibits
 * separately), not an identity verification mechanism.
 */
function handleRepresentsOwnName(handle: string, nameComponents: string[]): boolean {
  return nameComponents.every((part) => part.length > 0 && handle.includes(part));
}

/**
 * Lets a lawyer customise their own address — most importantly, after a
 * same-name collision silently assigned them a numeric suffix at
 * creation (startLawyerWebsite never blocks on this), so they're not
 * stuck with it. Always re-validated against their own name, never a
 * one-time check only at creation — the constraint holds for every edit.
 */
export async function updateLawyerWebsiteHandle(lawyerWebsiteId: string, candidateId: string, desiredHandle: string) {
  const site = await prisma.lawyerWebsite.findFirstOrThrow({
    where: { id: lawyerWebsiteId, candidateId },
    include: { candidate: { select: { firstName: true, lastName: true } } },
  });

  const handle = slugify(desiredHandle);
  const nameComponents =
    site.entityType === LawyerEntityType.LAW_FIRM
      ? [slugify(site.firmName ?? "")]
      : [slugify(site.candidate.firstName), slugify(site.candidate.lastName)];

  if (!handleRepresentsOwnName(handle, nameComponents)) throw new HandleNotOwnNameError();
  if (RESERVED_LAWYER_HANDLES.has(handle)) throw new HandleTakenError();

  try {
    return await prisma.lawyerWebsite.update({ where: { id: lawyerWebsiteId }, data: { handle, handleAutoSuffixedAt: null } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && p2002Target(e).includes("handle")) {
      throw new HandleTakenError();
    }
    throw e;
  }
}

export interface UpdateVerificationInput {
  scnNumber?: string | null;
  idCardEvidenceAssetId?: string | null;
  cacNumber?: string | null;
  firmEvidenceAssetId?: string | null;
}

/**
 * Resubmitting always goes back to PENDING and clears any prior rejection
 * — changing the evidence re-opens review (requirements register: only
 * an evidence/entity-type change re-triggers it, never a routine content
 * edit elsewhere on the site). Never touches isPublished — the Publish
 * gate itself is Phase 4.
 */
export async function updateLawyerWebsiteVerification(lawyerWebsiteId: string, input: UpdateVerificationInput) {
  return prisma.$transaction(async (tx) => {
    const verification = await tx.lawyerWebsiteVerification.update({
      where: { lawyerWebsiteId },
      data: {
        scnNumber: input.scnNumber?.trim() || null,
        idCardEvidenceAssetId: input.idCardEvidenceAssetId || null,
        cacNumber: input.cacNumber?.trim() || null,
        firmEvidenceAssetId: input.firmEvidenceAssetId || null,
        status: LawyerWebsiteVerificationStatus.PENDING,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedByStaffId: null,
        rejectionReason: null,
      },
    });
    await recordAuditEvent(tx, {
      subjectType: "lawyer_website_verification",
      subjectId: verification.id,
      action: "lawyer_website_verification.submitted",
      description: "Submitted identity verification evidence",
    });
    return verification;
  });
}

export async function acknowledgeConductDisclaimer(lawyerWebsiteId: string) {
  return prisma.lawyerWebsite.update({
    where: { id: lawyerWebsiteId },
    data: {
      conductDisclaimerAcknowledgedAt: new Date(),
      conductDisclaimerVersion: CONDUCT_DISCLAIMER_VERSION,
    },
  });
}

export interface UpdateAboutInput {
  introText?: string | null;
  biographyText?: string | null;
  personalStatementText?: string | null;
  careerJourneyText?: string | null;
  personalInterestsText?: string | null;
}

export async function updateLawyerWebsiteAbout(lawyerWebsiteId: string, input: UpdateAboutInput) {
  return prisma.lawyerWebsite.update({
    where: { id: lawyerWebsiteId },
    data: {
      introText: input.introText?.trim() || null,
      biographyText: input.biographyText?.trim() || null,
      personalStatementText: input.personalStatementText?.trim() || null,
      careerJourneyText: input.careerJourneyText?.trim() || null,
      personalInterestsText: input.personalInterestsText?.trim() || null,
    },
  });
}

// ─── Look & feel (Phase 5) ───────────────────────────────────────────

export interface UpdateLookAndFeelInput {
  templateKey: string;
  colorThemeKey: string;
  fontPairingKey: string;
}

export class TemplateNotAvailableError extends Error {
  constructor() {
    super("That template isn't available on your current plan.");
    this.name = "TemplateNotAvailableError";
  }
}

/**
 * Validated against the registry, not just any string — a PAID
 * template is refused outright here (Phase 6 is what actually lets a
 * candidate unlock one; until then every template is FREE, so this
 * branch is unreachable today but exists so Phase 6 doesn't need to
 * touch this function at all, only the registry).
 */
export async function updateLawyerWebsiteLookAndFeel(lawyerWebsiteId: string, input: UpdateLookAndFeelInput) {
  const template = LAWYER_WEBSITE_TEMPLATES.find((t) => t.key === input.templateKey);
  if (!template) throw new Error("Unknown template.");
  if (template.tier === "PAID") throw new TemplateNotAvailableError();
  if (!LAWYER_WEBSITE_COLOR_THEMES.some((t) => t.key === input.colorThemeKey)) throw new Error("Unknown color theme.");
  if (!LAWYER_WEBSITE_FONT_PAIRINGS.some((t) => t.key === input.fontPairingKey)) throw new Error("Unknown font pairing.");

  return prisma.lawyerWebsite.update({
    where: { id: lawyerWebsiteId },
    data: { templateKey: input.templateKey, colorThemeKey: input.colorThemeKey, fontPairingKey: input.fontPairingKey },
  });
}

// ─── Publishing, takedown & verification review (Phase 4) ──────────────

type Db = Prisma.TransactionClient | typeof prisma;

export interface PublishCheckFailure {
  reason: string;
}

export class PublishCheckError extends Error {
  failures: PublishCheckFailure[];
  constructor(failures: PublishCheckFailure[]) {
    super(failures.map((f) => f.reason).join(" "));
    this.name = "PublishCheckError";
    this.failures = failures;
  }
}

/**
 * Content + disclaimer + verification gate — same checkPublishable/
 * PublishCheckError shape as blog-admin-actions.ts. Takes a Db so
 * approveLawyerWebsiteVerification can run it inside the SAME
 * transaction as the approval it was just triggered by, rather than a
 * second, separately-committed read.
 */
export async function checkLawyerWebsitePublishable(db: Db, lawyerWebsiteId: string): Promise<PublishCheckFailure[]> {
  const site = await db.lawyerWebsite.findUniqueOrThrow({
    where: { id: lawyerWebsiteId },
    include: { qualifications: true, experiences: true, publications: true, activities: true, verification: true },
  });
  const failures: PublishCheckFailure[] = [];

  const hasContent =
    !!(site.introText || site.biographyText || site.personalStatementText || site.careerJourneyText || site.personalInterestsText) ||
    ((site.practiceAreas as string[] | null)?.length ?? 0) > 0 ||
    site.qualifications.length > 0 ||
    site.experiences.length > 0 ||
    site.publications.length > 0 ||
    site.activities.length > 0;
  if (!hasContent) failures.push({ reason: "Add some content to your site before publishing." });

  if (!site.conductDisclaimerAcknowledgedAt || site.conductDisclaimerVersion !== CONDUCT_DISCLAIMER_VERSION) {
    failures.push({ reason: "You must accept the current disclaimer before publishing." });
  }

  if (!site.verification || site.verification.status !== LawyerWebsiteVerificationStatus.APPROVED) {
    failures.push({ reason: "Your identity verification must be approved before you can publish." });
  }

  return failures;
}

async function publishLawyerWebsiteNow(db: Db, lawyerWebsiteId: string) {
  const site = await db.lawyerWebsite.update({
    where: { id: lawyerWebsiteId },
    data: { isPublished: true, publishedAt: new Date(), unpublishedAt: null, publishRequestedAt: null, takenDownAt: null, takenDownReason: null, takenDownByStaffId: null },
  });
  await recordAuditEvent(db, {
    subjectType: "lawyer_website",
    subjectId: site.id,
    action: "lawyer_website.published",
    description: `Published (handle: ${site.handle})`,
  });
  return site;
}

/**
 * Called when the candidate clicks Publish. Re-acknowledges the
 * disclaimer first — every click, never reused from an earlier visit
 * (requirements register). If verification is already APPROVED and the
 * content gate passes, this publishes immediately. If verification is
 * still PENDING, this records publishRequestedAt and throws a
 * PublishCheckError describing that it's queued, not rejected —
 * approveLawyerWebsiteVerification auto-publishes it the moment
 * approval happens, if the request is still waiting then. A REJECTED
 * verification fails clearly with the rejection reason, since nothing
 * will resolve that on its own — the candidate must resubmit evidence
 * (which itself returns verification to PENDING) before trying again.
 */
export async function requestPublishLawyerWebsite(lawyerWebsiteId: string) {
  await acknowledgeConductDisclaimer(lawyerWebsiteId);

  const verification = await prisma.lawyerWebsiteVerification.findUnique({ where: { lawyerWebsiteId } });

  if (!verification || verification.status === LawyerWebsiteVerificationStatus.PENDING) {
    await prisma.lawyerWebsite.update({ where: { id: lawyerWebsiteId }, data: { publishRequestedAt: new Date() } });
    throw new PublishCheckError([
      { reason: "Your identity verification is still under review. We'll notify you once it's approved, and your site will go live." },
    ]);
  }

  if (verification.status === LawyerWebsiteVerificationStatus.REJECTED) {
    throw new PublishCheckError([
      { reason: `Your identity verification was rejected: ${verification.rejectionReason ?? "no reason given"}. Update your evidence and resubmit before publishing.` },
    ]);
  }

  const failures = await checkLawyerWebsitePublishable(prisma, lawyerWebsiteId);
  if (failures.length > 0) throw new PublishCheckError(failures);

  return publishLawyerWebsiteNow(prisma, lawyerWebsiteId);
}

export async function approveLawyerWebsiteVerification(verificationId: string, staffId: string) {
  return prisma.$transaction(async (tx) => {
    const verification = await tx.lawyerWebsiteVerification.update({
      where: { id: verificationId },
      data: { status: LawyerWebsiteVerificationStatus.APPROVED, reviewedByStaffId: staffId, reviewedAt: new Date(), rejectionReason: null },
    });
    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "lawyer_website_verification",
      subjectId: verification.id,
      action: "lawyer_website_verification.approved",
      description: "Identity verification approved",
    });

    // If the candidate already clicked Publish while this was pending,
    // approval is what actually takes them live — not a second click.
    const site = await tx.lawyerWebsite.findUniqueOrThrow({ where: { id: verification.lawyerWebsiteId } });
    if (site.publishRequestedAt) {
      const failures = await checkLawyerWebsitePublishable(tx, site.id);
      if (failures.length === 0) await publishLawyerWebsiteNow(tx, site.id);
    }
    return verification;
  });
}

export async function rejectLawyerWebsiteVerification(verificationId: string, staffId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const verification = await tx.lawyerWebsiteVerification.update({
      where: { id: verificationId },
      data: { status: LawyerWebsiteVerificationStatus.REJECTED, reviewedByStaffId: staffId, reviewedAt: new Date(), rejectionReason: reason },
    });
    // Clear the pending publish request — rejection never resolves on its
    // own, so there's nothing left waiting for.
    await tx.lawyerWebsite.update({ where: { id: verification.lawyerWebsiteId }, data: { publishRequestedAt: null } });
    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "lawyer_website_verification",
      subjectId: verification.id,
      action: "lawyer_website_verification.rejected",
      description: `Identity verification rejected: ${reason}`,
      reason,
    });
    return verification;
  });
}

/** A deliberate admin action against one site specifically — independent of the candidate's course standing (requirements register). */
export async function takeDownLawyerWebsite(lawyerWebsiteId: string, staffId: string, reason: string) {
  const site = await prisma.lawyerWebsite.update({
    where: { id: lawyerWebsiteId },
    data: { isPublished: false, unpublishedAt: new Date(), takenDownAt: new Date(), takenDownReason: reason, takenDownByStaffId: staffId },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staffId,
    subjectType: "lawyer_website",
    subjectId: site.id,
    action: "lawyer_website.taken_down",
    description: `Website taken down: ${reason}`,
    reason,
  });
  return site;
}

/**
 * The automatic half of takedown: called from suspendCandidate
 * (candidate-status.ts) — takenDownByStaffId stays null here,
 * distinguishing "their course account was suspended" from a deliberate
 * admin action against the website itself. A no-op if they never built
 * a site, or it was never published.
 */
export async function takeDownLawyerWebsiteForSuspension(candidateId: string) {
  const site = await prisma.lawyerWebsite.findUnique({ where: { candidateId } });
  if (!site || !site.isPublished) return;
  await prisma.lawyerWebsite.update({
    where: { id: site.id },
    data: { isPublished: false, unpublishedAt: new Date(), takenDownAt: new Date(), takenDownReason: "Candidate account suspended", takenDownByStaffId: null },
  });
  await recordAuditEvent(prisma, {
    subjectType: "lawyer_website",
    subjectId: site.id,
    action: "lawyer_website.taken_down",
    description: "Website taken down automatically — candidate account suspended",
  });
}

// ─── Certificates available to connect (Qualifications) ────────────────

/**
 * Only ACTIVE certificates — unlike the candidate's own private
 * credentials page (which shows revoked/superseded too, for the
 * candidate's own transparency), a revoked or superseded credential
 * should never be connectable to a qualification entry on a PUBLIC site.
 */
export function getConnectableCertificates(candidateId: string) {
  return prisma.certificate.findMany({
    where: { candidateId, status: CertificateStatus.ACTIVE },
    orderBy: { issuedAt: "desc" },
    select: { id: true, programmeTitle: true, issuedAt: true },
  });
}

// ─── Qualifications ──────────────────────────────────────────────────

export interface AddQualificationInput {
  source: LawyerQualificationSource;
  title?: string;
  issuer?: string | null;
  year?: number | null;
  certificateId?: string;
}

/**
 * A connected certificate's title/year are a snapshot taken now, from
 * the certificate's own already-snapshotted fields — same snapshot-of-a-
 * snapshot discipline as everywhere else a Certificate feeds a display
 * elsewhere. certificateId is re-verified against candidateId + ACTIVE
 * here, never trusted from the caller — the picker only ever shows the
 * candidate their own connectable certificates, but the write path
 * checks again regardless.
 */
export async function addLawyerQualification(lawyerWebsiteId: string, candidateId: string, input: AddQualificationInput) {
  const orderIndex = await prisma.lawyerQualification.count({ where: { lawyerWebsiteId } });

  if (input.source === LawyerQualificationSource.LAVELLE_CERTIFICATE) {
    if (!input.certificateId) throw new Error("Choose a certificate to connect.");
    const certificate = await prisma.certificate.findFirst({
      where: { id: input.certificateId, candidateId, status: CertificateStatus.ACTIVE },
    });
    if (!certificate) throw new Error("That certificate could not be found.");
    return prisma.lawyerQualification.create({
      data: {
        lawyerWebsiteId,
        source: LawyerQualificationSource.LAVELLE_CERTIFICATE,
        title: certificate.programmeTitle,
        certificateId: certificate.id,
        year: certificate.issuedAt.getFullYear(),
        orderIndex,
      },
    });
  }

  if (!input.title?.trim()) throw new Error("Enter a title for this qualification.");
  return prisma.lawyerQualification.create({
    data: {
      lawyerWebsiteId,
      source: LawyerQualificationSource.MANUAL,
      title: input.title.trim(),
      issuer: input.issuer?.trim() || null,
      year: input.year ?? null,
      orderIndex,
    },
  });
}

export interface UpdateQualificationInput {
  title: string;
  issuer?: string | null;
  year?: number | null;
}

/** MANUAL entries only — a connected certificate's fields are a snapshot and never hand-edited; disconnect and reconnect instead. */
export async function updateLawyerQualification(id: string, lawyerWebsiteId: string, input: UpdateQualificationInput) {
  const existing = await prisma.lawyerQualification.findFirst({ where: { id, lawyerWebsiteId } });
  if (!existing) throw new Error("Qualification not found.");
  if (existing.source !== LawyerQualificationSource.MANUAL) throw new Error("A connected certificate can't be edited — remove it and reconnect instead.");
  return prisma.lawyerQualification.update({
    where: { id },
    data: { title: input.title.trim(), issuer: input.issuer?.trim() || null, year: input.year ?? null },
  });
}

/** lawyerWebsiteId is always part of the where clause — never delete by id alone, so one candidate's action can't reach another's row by guessing an id. Same rule for every delete/reorder below. */
export async function deleteLawyerQualification(id: string, lawyerWebsiteId: string) {
  await prisma.lawyerQualification.deleteMany({ where: { id, lawyerWebsiteId } });
}

export async function reorderLawyerQualifications(lawyerWebsiteId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, orderIndex) => prisma.lawyerQualification.updateMany({ where: { id, lawyerWebsiteId }, data: { orderIndex } }))
  );
}

// ─── Experience ──────────────────────────────────────────────────────

export interface ExperienceInput {
  organisation: string;
  roleTitle: string;
  startYear: number;
  endYear?: number | null;
  isCurrent: boolean;
  description?: string | null;
}

export async function addLawyerExperience(lawyerWebsiteId: string, input: ExperienceInput) {
  const orderIndex = await prisma.lawyerExperience.count({ where: { lawyerWebsiteId } });
  return prisma.lawyerExperience.create({
    data: {
      lawyerWebsiteId,
      organisation: input.organisation.trim(),
      roleTitle: input.roleTitle.trim(),
      startYear: input.startYear,
      endYear: input.isCurrent ? null : input.endYear ?? null,
      isCurrent: input.isCurrent,
      description: input.description?.trim() || null,
      orderIndex,
    },
  });
}

export async function updateLawyerExperience(id: string, lawyerWebsiteId: string, input: ExperienceInput) {
  const result = await prisma.lawyerExperience.updateMany({
    where: { id, lawyerWebsiteId },
    data: {
      organisation: input.organisation.trim(),
      roleTitle: input.roleTitle.trim(),
      startYear: input.startYear,
      endYear: input.isCurrent ? null : input.endYear ?? null,
      isCurrent: input.isCurrent,
      description: input.description?.trim() || null,
    },
  });
  if (result.count === 0) throw new Error("Experience entry not found.");
}

export async function deleteLawyerExperience(id: string, lawyerWebsiteId: string) {
  await prisma.lawyerExperience.deleteMany({ where: { id, lawyerWebsiteId } });
}

export async function reorderLawyerExperiences(lawyerWebsiteId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, orderIndex) => prisma.lawyerExperience.updateMany({ where: { id, lawyerWebsiteId }, data: { orderIndex } }))
  );
}

// ─── Publications (external link, or a native article with its own URL) ─

export interface PublicationInput {
  kind: "EXTERNAL_LINK" | "NATIVE_ARTICLE";
  title: string;
  externalUrl?: string | null;
  excerpt?: string | null;
  body?: string | null;
}

/**
 * A native article's slug is generated once, at creation, from its
 * title, with the same numeric-suffix retry as createBlogPost/
 * startLawyerWebsite — but scoped to the *global* LawyerPublication.slug
 * column (deliberately not scoped per-site): simpler schema, and the
 * public URL already carries the lawyer's own handle ahead of it, so a
 * shared slug namespace costs nothing but an occasional extra retry.
 * Never regenerated on an edit — same "slug survives a title change"
 * rule as BlogPost.
 */
export async function addLawyerPublication(lawyerWebsiteId: string, input: PublicationInput) {
  const orderIndex = await prisma.lawyerPublication.count({ where: { lawyerWebsiteId } });

  if (input.kind === "EXTERNAL_LINK") {
    if (!input.externalUrl?.trim()) throw new Error("Enter a link to the publication.");
    return prisma.lawyerPublication.create({
      data: { lawyerWebsiteId, kind: "EXTERNAL_LINK", title: input.title.trim(), externalUrl: input.externalUrl.trim(), orderIndex },
    });
  }

  const base = slugify(input.title) || "article";
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      return await prisma.lawyerPublication.create({
        data: {
          lawyerWebsiteId,
          kind: "NATIVE_ARTICLE",
          title: input.title.trim(),
          slug,
          excerpt: input.excerpt?.trim() || null,
          body: input.body?.trim() || null,
          orderIndex,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && p2002Target(e).includes("slug") && attempt < 4) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique article address. Please try again.");
}

export interface UpdatePublicationInput {
  title: string;
  externalUrl?: string | null;
  excerpt?: string | null;
  body?: string | null;
  isPublished?: boolean;
}

export async function updateLawyerPublication(id: string, lawyerWebsiteId: string, input: UpdatePublicationInput) {
  const existing = await prisma.lawyerPublication.findFirst({ where: { id, lawyerWebsiteId } });
  if (!existing) throw new Error("Publication not found.");

  const data: Prisma.LawyerPublicationUpdateInput = { title: input.title.trim() };
  if (existing.kind === "EXTERNAL_LINK") {
    data.externalUrl = input.externalUrl?.trim() || null;
  } else {
    data.excerpt = input.excerpt?.trim() || null;
    data.body = input.body?.trim() || null;
    if (input.isPublished !== undefined) {
      data.isPublished = input.isPublished;
      data.publishedAt = input.isPublished ? (existing.publishedAt ?? new Date()) : existing.publishedAt;
    }
  }
  return prisma.lawyerPublication.update({ where: { id }, data });
}

export async function deleteLawyerPublication(id: string, lawyerWebsiteId: string) {
  await prisma.lawyerPublication.deleteMany({ where: { id, lawyerWebsiteId } });
}

export async function reorderLawyerPublications(lawyerWebsiteId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, orderIndex) => prisma.lawyerPublication.updateMany({ where: { id, lawyerWebsiteId }, data: { orderIndex } }))
  );
}

// ─── Activities (memberships, speaking engagements, achievements) ──────

export interface ActivityInput {
  title: string;
  description?: string | null;
  year?: number | null;
}

export async function addLawyerActivity(lawyerWebsiteId: string, input: ActivityInput) {
  const orderIndex = await prisma.lawyerActivity.count({ where: { lawyerWebsiteId } });
  return prisma.lawyerActivity.create({
    data: { lawyerWebsiteId, title: input.title.trim(), description: input.description?.trim() || null, year: input.year ?? null, orderIndex },
  });
}

export async function updateLawyerActivity(id: string, lawyerWebsiteId: string, input: ActivityInput) {
  const result = await prisma.lawyerActivity.updateMany({
    where: { id, lawyerWebsiteId },
    data: { title: input.title.trim(), description: input.description?.trim() || null, year: input.year ?? null },
  });
  if (result.count === 0) throw new Error("Activity not found.");
}

export async function deleteLawyerActivity(id: string, lawyerWebsiteId: string) {
  await prisma.lawyerActivity.deleteMany({ where: { id, lawyerWebsiteId } });
}

export async function reorderLawyerActivities(lawyerWebsiteId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, orderIndex) => prisma.lawyerActivity.updateMany({ where: { id, lawyerWebsiteId }, data: { orderIndex } }))
  );
}
