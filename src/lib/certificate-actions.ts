import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { renderCertificatePdf } from "@/lib/certificate-pdf";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
import { tierLabel } from "@/lib/format";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { getFirstName } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";
import type { CertificateStatus, GradeBand, Prisma } from "@/generated/prisma/client";

// No "server-only" / staff-auth / candidate-session import here,
// deliberately — issueCertificate is a plain function called directly by
// Slice 06's releaseResults (itself plain), and revoke/reissue take
// staffId as an explicit parameter from their "use server" callers. Same
// discipline as every other core-lib file in this project.

const BAND_LABEL: Record<GradeBand, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };

async function uploadCertificatePdfToCloudinary(
  pdfBytes: Buffer,
  certificateNumber: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "lavelle/certificates",
        resource_type: "auto",
        original_filename: `${certificateNumber}.pdf`,
        type: "authenticated",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve((result as any).public_id);
      }
    );
    uploadStream.end(pdfBytes);
  });
}

/**
 * The printed certificate's own band — deliberately NOT the same scale
 * as GradeBandDefinition (which still resolves Sitting.band, a 4-tier
 * scale including Merit, used for internal/result-page display and the
 * Advanced Practitioner "Merit or above" eligibility check). A
 * certificate only ever reads Distinction or Pass, on a fixed
 * institutional scale independent of any per-exam configuration: 60%+ is
 * Distinction, anything else that already passed is Pass. Whether a
 * sitting passed at all is untouched — that's still entirely the exam's
 * own configured passMarkPercent (resolved into Sitting.outcome by
 * releaseResults); this only decides which of the two certificate-worthy
 * labels a PASS gets.
 */
function certificateBandFor(totalPercent: number): "DISTINCTION" | "PASS" {
  return totalPercent >= 60 ? "DISTINCTION" : "PASS";
}

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
interface CertificateEmailData {
  email: string;
  firstName: string;
  certificateId: string;
  certificateNumber: string;
  issuedAt: Date;
  band: GradeBand;
  programmeTitle: string;
  tier: string;
}

export async function issueCertificate(sittingId: string, mintedByStaffId: string) {
  let emailData: CertificateEmailData | null = null;

  const certificate = await prisma.$transaction(async (tx) => {
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
    const certBand = certificateBandFor(sitting.totalPercent);

    const pdfBytes = await renderCertificatePdf({
      certificateNumber,
      holderName,
      programmeTitle: programme.title,
      tierLabel: tierLabel(programme.tier),
      bandLabel: BAND_LABEL[certBand],
      pathway,
      issuedAt,
      signatoryBlock: template.signatoryBlock,
    });

    const storageKey = await uploadCertificatePdfToCloudinary(pdfBytes, certificateNumber);
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

    const cert = await tx.certificate.create({
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
        band: certBand,
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
      subjectId: cert.id,
      action: "certificate.issued",
      description: `Certificate ${certificateNumber} issued to ${holderName} for ${programme.title}`,
      ipAddress: null,
    });

    // Capture email data for async sending
    emailData = {
      email: candidate.email,
      firstName: candidate.firstName,
      certificateId: cert.id,
      certificateNumber,
      issuedAt,
      band: certBand,
      programmeTitle: programme.title,
      tier: programme.tier,
    };

    return cert;
  });

  // Send certificate-issued email asynchronously — do not block the transaction
  if (emailData) {
    const data: CertificateEmailData = emailData;
    (async () => {
      try {
        const certificateDownloadUrl = `${process.env.NEXTAUTH_URL}/portal/credentials/${data.certificateId}/download`;
        const certificateVerificationUrl = `${process.env.NEXTAUTH_URL}/verify/${data.certificateNumber}`;

        await sendTransactionalEmailByTemplate("certificate-issued", data.email, {
          firstName: getFirstName(data.firstName),
          programmeName: data.programmeTitle,
          tier: data.tier,
          grade: BAND_LABEL[data.band],
          certificateId: data.certificateNumber,
          issueDate: data.issuedAt.toLocaleDateString(),
          certificateDownloadUrl,
          certificateVerificationUrl,
          supportEmail: EMAIL_CONFIG.supportEmail,
          currentYear: new Date().getFullYear(),
        });
      } catch (emailError) {
        console.error("Failed to send certificate-issued email:", emailError);
        // Do not fail the certificate issuance on email errors
      }
    })();
  }

  return certificate;
}

export class NotEligibleForCourseCertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotEligibleForCourseCertificateError";
  }
}

/**
 * The other issuing path, for a programme that carries no certifying
 * examination at all (Programme.exam is null) — there's no Sitting to
 * pass, so completing the course itself is what earns the credential.
 * Only reachable from completeProgramme once every lecture is COMPLETED;
 * re-checks eligibility here anyway (never trust the caller). Idempotent
 * like issueCertificate. Every module quiz must have a passed attempt —
 * finalPercent is their average, or 100 (an automatic Distinction) when
 * the programme has no quizzes to average. pathway is always PATHWAY:
 * a no-exam programme has no EXAMINATION_ONLY route.
 */
export async function issueCertificateForCourseCompletion(enrolmentId: string) {
  return prisma.$transaction(async (tx) => {
    const enrolment = await tx.enrolment.findUniqueOrThrow({
      where: { id: enrolmentId },
      include: { candidate: true, programme: { include: { exam: { select: { id: true } } } } },
    });
    if (enrolment.programme.exam) {
      throw new NotEligibleForCourseCertificateError("This programme has a certifying examination.");
    }

    const existing = await tx.certificate.findFirst({
      where: { candidateId: enrolment.candidateId, programmeId: enrolment.programmeId, status: "ACTIVE" },
    });
    if (existing) return existing; // idempotent — re-clicking Complete Programme must not mint two

    const [totalPublished, completedCount] = await Promise.all([
      tx.lecture.count({ where: { module: { programmeId: enrolment.programmeId }, status: "PUBLISHED" } }),
      tx.lectureProgress.count({ where: { enrolmentId, state: "COMPLETED" } }),
    ]);
    if (totalPublished === 0 || completedCount < totalPublished) {
      throw new NotEligibleForCourseCertificateError("Not every lecture in this programme has been completed yet.");
    }

    const modules = await tx.module.findMany({
      where: { programmeId: enrolment.programmeId },
      include: { quiz: { include: { questions: { select: { id: true } } } } },
    });
    const quizModules = modules.filter((m) => m.quiz && m.quiz.status === "PUBLISHED" && m.quiz.questions.length > 0);

    let scoreSum = 0;
    for (const m of quizModules) {
      const latest = await tx.quizAttempt.findFirst({
        where: { enrolmentId, quizId: m.quiz!.id, submittedAt: { not: null } },
        orderBy: { attemptNumber: "desc" },
      });
      if (!latest || !latest.passed) {
        throw new NotEligibleForCourseCertificateError(`The "${m.title}" quiz has not been passed yet.`);
      }
      scoreSum += latest.scorePercent ?? 0;
    }
    const finalPercent = quizModules.length > 0 ? Math.round(scoreSum / quizModules.length) : 100;
    const band = certificateBandFor(finalPercent);

    const template = await findActiveTemplate(enrolment.programme.tier, tx);
    if (!template) throw new NoActiveTemplateError();

    const numberRows = await tx.$queryRaw<{ next_certificate_number: string }[]>`SELECT next_certificate_number()`;
    const certificateNumber = numberRows[0]!.next_certificate_number;
    const { candidate, programme } = enrolment;
    const holderName = `${candidate.firstName} ${candidate.lastName}`;
    const issuedAt = new Date();

    const pdfBytes = await renderCertificatePdf({
      certificateNumber,
      holderName,
      programmeTitle: programme.title,
      tierLabel: tierLabel(programme.tier),
      bandLabel: BAND_LABEL[band],
      pathway: "PATHWAY",
      issuedAt,
      signatoryBlock: template.signatoryBlock,
    });
    const storageKey = await uploadCertificatePdfToCloudinary(pdfBytes, certificateNumber);
    const pdfAsset = await tx.mediaAsset.create({
      data: {
        kind: "document",
        storageKey,
        mimeType: "application/pdf",
        bytes: pdfBytes.length,
        originalFilename: `${certificateNumber}.pdf`,
        uploadedByCandidateId: candidate.id,
      },
    });

    const certificate = await tx.certificate.create({
      data: {
        certificateNumber,
        candidateId: candidate.id,
        programmeId: programme.id,
        sittingId: null,
        enrolmentId,
        pathway: "PATHWAY",
        holderName,
        candidateNumber: candidate.candidateNumber,
        programmeTitle: programme.title,
        tier: programme.tier,
        finalPercent,
        band,
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
      description: `Certificate ${certificateNumber} issued to ${holderName} for ${programme.title} on course completion`,
      ipAddress: null,
    });

    return certificate;
  });
}

/**
 * Catch-up, not the normal path — releaseResults already issues a
 * certificate for every PASS sitting automatically the moment a window
 * is released. This exists for the gap that leaves behind: a window
 * released before a template existed for its tier, or any other transient
 * failure that skipped issuance for an otherwise-passed sitting. Reuses
 * issueCertificate itself (idempotent, same rules), never a second issuing
 * path.
 */
export async function bulkIssueCertificatesForWindow(windowId: string, staffId: string, ipAddress: string | null) {
  const sittings = await prisma.sitting.findMany({
    where: { state: "RELEASED", outcome: "PASS", certificate: null, registration: { windowId } },
    select: { id: true },
  });

  let issued = 0;
  const errors: string[] = [];
  for (const s of sittings) {
    try {
      await issueCertificate(s.id, staffId);
      issued++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Unknown error");
    }
  }

  if (issued > 0) {
    await recordAuditEvent(prisma, {
      actorStaffId: staffId,
      subjectType: "exam_window",
      subjectId: windowId,
      action: "exam_window.certificates_bulk_issued",
      description: `Bulk-issued ${issued} certificate${issued === 1 ? "" : "s"} for exam window ${windowId}`,
      ipAddress,
    });
  }

  return { issued, attempted: sittings.length, errors };
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
    const storageKey = await uploadCertificatePdfToCloudinary(pdfBytes, certificateNumber);
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

  const updated = await prisma.$transaction(async (tx) => {
    const certificate = await tx.certificate.findUnique({ where: { id } });
    if (!certificate) throw new CertificateNotFoundError();
    if (certificate.status === "REVOKED") throw new AlreadyRevokedError();
    if (certificate.status === "SUPERSEDED") throw new AlreadySupersededError();

    const now = new Date();
    const result = await tx.certificate.update({
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

    return { certificate, result };
  });

  // Send certificate-revoked email asynchronously — do not block the revocation
  (async () => {
    try {
      const candidate = await prisma.candidate.findUniqueOrThrow({
        where: { id: updated.certificate.candidateId },
      });

      const appealDeadlineDate = new Date();
      appealDeadlineDate.setDate(appealDeadlineDate.getDate() + EMAIL_CONFIG.appealDeadlineDays);

      await sendTransactionalEmailByTemplate("certificate-revoked", candidate.email, {
        firstName: getFirstName(candidate.firstName),
        programmeName: updated.certificate.programmeTitle,
        tier: updated.certificate.tier,
        certificateId: updated.certificate.certificateNumber,
        revocationReason: trimmedReason,
        appealDeadlineDate: appealDeadlineDate.toLocaleDateString(),
        appealInstructionsUrl: `${process.env.NEXTAUTH_URL}/appeals/new`,
        supportEmail: EMAIL_CONFIG.supportEmail,
        securityContactEmail: EMAIL_CONFIG.securityContactEmail,
        currentYear: new Date().getFullYear(),
      });
    } catch (emailError) {
      console.error("Failed to send certificate-revoked email:", emailError);
      // Do not fail the revocation on email errors
    }
  })();

  return updated.result;
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
    const storageKey = await uploadCertificatePdfToCloudinary(pdfBytes, certificateNumber);
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
