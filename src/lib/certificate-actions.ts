import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { writeBlob } from "@/lib/storage";
import { renderCertificatePdf } from "@/lib/certificate-pdf";
import { tierLabel } from "@/lib/format";
import type { CertificateStatus, GradeBand, Prisma } from "@/generated/prisma/client";

// No "server-only" / staff-auth / candidate-session import here,
// deliberately — issueCertificate is a plain function called directly by
// Slice 06's releaseResults (itself plain), and revoke/reissue take
// staffId as an explicit parameter from their "use server" callers. Same
// discipline as every other core-lib file in this project.

const BAND_LABEL: Record<GradeBand, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };

export class CertificateNotFoundError extends Error {
  constructor() {
    super("That certificate does not exist.");
    this.name = "CertificateNotFoundError";
  }
}
export class AlreadyRevokedError extends Error {
  constructor() {
    super("This certificate has already been revoked.");
    this.name = "AlreadyRevokedError";
  }
}
export class AlreadySupersededError extends Error {
  constructor() {
    super("This certificate has already been superseded.");
    this.name = "AlreadySupersededError";
  }
}
export class NoActiveTemplateError extends Error {
  constructor() {
    super("No active certificate template covers this tier. Activate one before issuing.");
    this.name = "NoActiveTemplateError";
  }
}

/** The template in force for a tier (rule 9) — a tier-specific active template wins over the all-tiers fallback. */
async function findActiveTemplate(tier: string, db: Prisma.TransactionClient | typeof prisma) {
  const specific = await db.certificateTemplate.findFirst({ where: { isActive: true, appliesToTier: tier as never } });
  if (specific) return specific;
  return db.certificateTemplate.findFirst({ where: { isActive: true, appliesToTier: null } });
}

/**
 * Triggered by Slice 06's releaseResults when outcome = PASS. One
 * transaction, the eight numbered steps from the README:
 * 1. Re-read the sitting FOR UPDATE; if a certificate already exists for
 *    it, return it — idempotent (rule 12), a retried release cannot
 *    produce two.
 * 2. Allocate certificateNumber from the year sequence — never COUNT(*).
 * 3. Resolve the pathway from the registration's enrolmentId, store it.
 * 4. Snapshot finalPercent, band, tier and the template in force
 *    (rule 2) — every one of these is copied, never a live reference.
 * 5. Render the PDF, store as a MediaAsset.
 * 6. Insert the certificate.
 * 7. Notify the candidate (category CREDENTIAL).
 * 8. audit_event: certificate.issued.
 *
 * mintedByStaffId backs the generated PDF's MediaAsset.uploadedByStaffId
 * (a required column) — issuedByStaffId on the Certificate itself stays
 * null, which is what marks this as an automatic issue.
 */
export async function issueCertificate(sittingId: string, mintedByStaffId: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Sitting" WHERE id = ${sittingId} FOR UPDATE`;
    if (rows.length === 0) throw new Error("Sitting not found.");

    const existing = await tx.certificate.findUnique({ where: { sittingId } });
    if (existing) return existing; // idempotent — a retried release must not produce two (rule 12)

    const sitting = await tx.sitting.findUniqueOrThrow({
      where: { id: sittingId },
      include: { registration: { include: { candidate: true, exam: { include: { programme: true } } } } },
    });
    if (sitting.outcome !== "PASS" || sitting.totalPercent == null || sitting.band == null) {
      throw new Error("Only a passed, fully-scored sitting can issue a certificate.");
    }

    const { registration } = sitting;
    const { candidate, exam } = registration;
    const programme = exam.programme;

    const template = await findActiveTemplate(programme.tier, tx);
    if (!template) throw new NoActiveTemplateError();

    const numberRows = await tx.$queryRaw<{ next_certificate_number: string }[]>`SELECT next_certificate_number()`;
    const certificateNumber = numberRows[0]!.next_certificate_number;

    const pathway = registration.enrolmentId ? "PATHWAY" : "EXAMINATION_ONLY";
    const holderName = `${candidate.firstName} ${candidate.lastName}`;
    const issuedAt = new Date();

    const pdfBytes = await renderCertificatePdf({
      certificateNumber,
      holderName,
      programmeTitle: programme.title,
      tierLabel: tierLabel(programme.tier),
      bandLabel: BAND_LABEL[sitting.band],
      pathway,
      issuedAt,
      signatoryBlock: template.signatoryBlock,
    });
    const storageKey = `certificates/${certificateNumber}.pdf`;
    await writeBlob(storageKey, pdfBytes);
    const pdfAsset = await tx.mediaAsset.create({
      data: {
        kind: "document",
        storageKey,
        mimeType: "application/pdf",
        bytes: pdfBytes.length,
        originalFilename: `${certificateNumber}.pdf`,
        uploadedByStaffId: mintedByStaffId,
      },
    });

    const certificate = await tx.certificate.create({
      data: {
        certificateNumber,
        candidateId: candidate.id,
        programmeId: programme.id,
        sittingId: sitting.id,
        enrolmentId: registration.enrolmentId,
        pathway,
        holderName,
        candidateNumber: candidate.candidateNumber,
        programmeTitle: programme.title,
        tier: programme.tier,
        finalPercent: sitting.totalPercent,
        band: sitting.band,
        status: "ACTIVE",
        issuedAt,
        issuedByStaffId: null, // automatic issue
        templateId: template.id,
        pdfAssetId: pdfAsset.id,
      },
    });

    await tx.notification.create({
      data: {
        candidateId: candidate.id,
        category: "CREDENTIAL",
        title: `Certificate issued — ${certificateNumber}`,
        body: `Your certificate for ${programme.title} has been issued. Find it under Credentials.`,
      },
    });

    await recordAuditEvent(tx, {
      actorStaffId: null,
      subjectType: "certificate",
      subjectId: certificate.id,
      action: "certificate.issued",
      description: `Certificate ${certificateNumber} issued to ${holderName} for ${programme.title}`,
      ipAddress: null,
    });

    return certificate;
  });
}

export interface ManualIssueInput {
  candidateId: string;
  programmeId: string;
  enrolmentId?: string | null;
  finalPercent: number;
  band: GradeBand;
  reason: string;
}

/** For edge cases the automatic path can't reach — a paper sitting, an appeal upheld. Requires issue_certificates plus a reason. */
export async function issueCertificateManually(input: ManualIssueInput, staffId: string, ipAddress: string | null) {
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to issue a certificate manually.");

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.findUniqueOrThrow({ where: { id: input.candidateId } });
    const programme = await tx.programme.findUniqueOrThrow({ where: { id: input.programmeId } });
    const template = await findActiveTemplate(programme.tier, tx);
    if (!template) throw new NoActiveTemplateError();

    const numberRows = await tx.$queryRaw<{ next_certificate_number: string }[]>`SELECT next_certificate_number()`;
    const certificateNumber = numberRows[0]!.next_certificate_number;
    const pathway = input.enrolmentId ? "PATHWAY" : "EXAMINATION_ONLY";
    const holderName = `${candidate.firstName} ${candidate.lastName}`;
    const issuedAt = new Date();

    const pdfBytes = await renderCertificatePdf({
      certificateNumber,
      holderName,
      programmeTitle: programme.title,
      tierLabel: tierLabel(programme.tier),
      bandLabel: BAND_LABEL[input.band],
      pathway,
      issuedAt,
      signatoryBlock: template.signatoryBlock,
    });
    const storageKey = `certificates/${certificateNumber}.pdf`;
    await writeBlob(storageKey, pdfBytes);
    const pdfAsset = await tx.mediaAsset.create({
      data: {
        kind: "document",
        storageKey,
        mimeType: "application/pdf",
        bytes: pdfBytes.length,
        originalFilename: `${certificateNumber}.pdf`,
        uploadedByStaffId: staffId,
      },
    });

    const certificate = await tx.certificate.create({
      data: {
        certificateNumber,
        candidateId: candidate.id,
        programmeId: programme.id,
        sittingId: null,
        enrolmentId: input.enrolmentId ?? null,
        pathway,
        holderName,
        candidateNumber: candidate.candidateNumber,
        programmeTitle: programme.title,
        tier: programme.tier,
        finalPercent: input.finalPercent,
        band: input.band,
        status: "ACTIVE",
        issuedAt,
        issuedByStaffId: staffId,
        templateId: template.id,
        pdfAssetId: pdfAsset.id,
      },
    });

    await tx.notification.create({
      data: {
        candidateId: candidate.id,
        category: "CREDENTIAL",
        title: `Certificate issued — ${certificateNumber}`,
        body: `Your certificate for ${programme.title} has been issued. Find it under Credentials.`,
      },
    });

    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "certificate",
      subjectId: certificate.id,
      action: "certificate.issued",
      description: `Certificate ${certificateNumber} issued manually to ${holderName} for ${programme.title}`,
      reason: trimmedReason,
      ipAddress,
    });

    return certificate;
  });
}

/**
 * Withdraws the credential (rule 5/6) — the row stays on the record as
 * REVOKED with its reason and date, forever (rule 3: the number is never
 * reused). Deliberately touches nothing about the candidate's programme
 * access, results, or practice record — only this Certificate row and
 * the audit log.
 */
export async function revokeCertificate(id: string, reason: string, staffId: string, ipAddress: string | null) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to revoke a certificate.");

  return prisma.$transaction(async (tx) => {
    const certificate = await tx.certificate.findUnique({ where: { id } });
    if (!certificate) throw new CertificateNotFoundError();
    if (certificate.status === "REVOKED") throw new AlreadyRevokedError();
    if (certificate.status === "SUPERSEDED") throw new AlreadySupersededError();

    const now = new Date();
    const updated = await tx.certificate.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: now, revokedReason: trimmedReason, revokedByStaffId: staffId },
    });

    await tx.notification.create({
      data: {
        candidateId: certificate.candidateId,
        category: "CREDENTIAL",
        title: `Certificate ${certificate.certificateNumber} revoked`,
        body: `Your certificate for ${certificate.programmeTitle} has been revoked: ${trimmedReason}. Your programme access and results are unaffected.`,
      },
    });

    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "certificate",
      subjectId: id,
      action: "certificate.revoked",
      description: `Revoked certificate ${certificate.certificateNumber}`,
      reason: trimmedReason,
      ipAddress,
    });

    return updated;
  });
}

/**
 * Produces a NEW certificate with a NEW number (rule 7) — the old one
 * becomes SUPERSEDED, never re-marked as if it had never existed, and
 * both directions of the link are written independently (rule: the two
 * self-relation columns are set together here, not derived from one
 * another). A REVOKED certificate can be re-issued this way too — that
 * is what an upheld appeal looks like, and its own status stays REVOKED
 * (the chain reads "revoked, then replaced," not "never happened").
 */
export async function reissueCertificate(id: string, reason: string, staffId: string, ipAddress: string | null) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required to re-issue a certificate.");

  return prisma.$transaction(async (tx) => {
    const original = await tx.certificate.findUnique({ where: { id } });
    if (!original) throw new CertificateNotFoundError();
    if (original.status === "SUPERSEDED") throw new AlreadySupersededError();

    const template = await findActiveTemplate(original.tier, tx);
    if (!template) throw new NoActiveTemplateError();

    const numberRows = await tx.$queryRaw<{ next_certificate_number: string }[]>`SELECT next_certificate_number()`;
    const certificateNumber = numberRows[0]!.next_certificate_number;
    const issuedAt = new Date();

    const pdfBytes = await renderCertificatePdf({
      certificateNumber,
      holderName: original.holderName,
      programmeTitle: original.programmeTitle,
      tierLabel: tierLabel(original.tier),
      bandLabel: BAND_LABEL[original.band],
      pathway: original.pathway,
      issuedAt,
      signatoryBlock: template.signatoryBlock,
    });
    const storageKey = `certificates/${certificateNumber}.pdf`;
    await writeBlob(storageKey, pdfBytes);
    const pdfAsset = await tx.mediaAsset.create({
      data: {
        kind: "document",
        storageKey,
        mimeType: "application/pdf",
        bytes: pdfBytes.length,
        originalFilename: `${certificateNumber}.pdf`,
        uploadedByStaffId: staffId,
      },
    });

    const successor = await tx.certificate.create({
      data: {
        certificateNumber,
        candidateId: original.candidateId,
        programmeId: original.programmeId,
        sittingId: null,
        enrolmentId: original.enrolmentId,
        pathway: original.pathway,
        holderName: original.holderName,
        candidateNumber: original.candidateNumber,
        programmeTitle: original.programmeTitle,
        tier: original.tier,
        finalPercent: original.finalPercent,
        band: original.band,
        status: "ACTIVE",
        issuedAt,
        issuedByStaffId: staffId,
        templateId: template.id,
        pdfAssetId: pdfAsset.id,
        replacesId: original.id,
      },
    });

    // The status a superseded original keeps is whatever it already was
    // (REVOKED stays REVOKED — an appeal does not erase the finding it
    // upheld; anything else becomes SUPERSEDED, since it was never invalid).
    const originalNextStatus: CertificateStatus = original.status === "REVOKED" ? "REVOKED" : "SUPERSEDED";
    await tx.certificate.update({
      where: { id: original.id },
      data: { status: originalNextStatus, supersededById: successor.id },
    });

    await tx.notification.create({
      data: {
        candidateId: original.candidateId,
        category: "CREDENTIAL",
        title: `Certificate re-issued — ${certificateNumber}`,
        body: `A new certificate (${certificateNumber}) has been issued for ${original.programmeTitle}, replacing ${original.certificateNumber}.`,
      },
    });

    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "certificate",
      subjectId: successor.id,
      action: "certificate.reissued",
      description: `Re-issued certificate ${original.certificateNumber} as ${certificateNumber}`,
      reason: trimmedReason,
      ipAddress,
    });

    return successor;
  });
}
