import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { testPrisma } from "./db";
import {
  issueCertificate,
  revokeCertificate,
  reissueCertificate,
  NoActiveTemplateError,
} from "@/lib/certificate-actions";
import { verifyCertificate } from "@/lib/certificate-verify";
import { verifyCertificatePdfLink, getSignedCertificatePdfUrl } from "@/lib/certificate-pdf";
import { getCandidateCredentials } from "@/lib/certificate-candidate-reads";
import { registerForExam, startSitting, saveSittingAnswer, submitSitting, releaseResults } from "@/lib/exam-sitting-actions";
import { GET as verifyGet } from "@/app/api/verify/route";
import { GET as pdfGet } from "@/app/api/certificates/[id]/pdf/route";

async function seedStaffAndCategory() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Cert Staff", email: `cert-test-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Cert Test Category ${crypto.randomUUID()}`, slug: `cert-test-${crypto.randomUUID()}` },
  });
  return { staff, category };
}

async function seedProgramme(categoryId: string, staffId: string) {
  return testPrisma.programme.create({
    data: {
      code: `CRT-${crypto.randomUUID().slice(0, 8)}`,
      title: "Certificate Test Programme",
      categoryId,
      tier: "SPECIALIST",
      status: "ACTIVE",
      summary: "test",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      credits: 24,
      feeMinor: 45_000_000,
      createdByStaffId: staffId,
    },
  });
}

async function seedTemplate(staffId: string) {
  const artwork = await testPrisma.mediaAsset.create({
    data: { kind: "image", storageKey: `test/artwork-${crypto.randomUUID()}.png`, mimeType: "image/png", bytes: 100, originalFilename: "artwork.png", uploadedByStaffId: staffId },
  });
  return testPrisma.certificateTemplate.create({
    data: {
      name: `Test template ${crypto.randomUUID().slice(0, 6)}`,
      artworkAssetId: artwork.id,
      appliesToTier: null,
      signatoryBlock: "Registrar",
      printedFields: { name: true },
      isActive: true,
      activatedAt: new Date(),
      createdByStaffId: staffId,
    },
  });
}

async function seedCandidate() {
  return testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      candidateNumber: `LVL/TEST/${crypto.randomUUID().slice(0, 5)}`,
      firstName: "Ijeoma",
      lastName: "Chukwu",
      email: `cert-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
}

/** Drives a real sitting through to a PASSED, RELEASED state via the real Slice 06 functions — issueCertificate fires as a side effect of releaseResults. */
async function seedReleasedPassingSitting(programmeId: string, staffId: string) {
  const mod = await testPrisma.module.create({ data: { programmeId, weekNumber: 1, title: "Week 1", orderIndex: 0, examQuestionDraw: 1 } });
  const exam = await testPrisma.exam.create({ data: { programmeId, status: "PUBLISHED", durationMinutes: 60, passMarkPercent: 50, feeMinor: 1_000_000 } });
  const question = await testPrisma.examQuestion.create({
    data: {
      examId: exam.id,
      moduleId: mod.id,
      type: "OBJECTIVE",
      status: "APPROVED",
      prompt: "Q",
      marks: 2,
      options: { create: [{ orderIndex: 0, text: "Right", isCorrect: true }, { orderIndex: 1, text: "Wrong", isCorrect: false }] },
    },
    include: { options: true },
  });
  const window = await testPrisma.examWindow.create({
    data: { examId: exam.id, opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000), registrationDeadline: new Date(Date.now() + 3_600_000) },
  });
  const candidate = await seedCandidate();
  const payment = await testPrisma.payment.create({
    data: { candidateId: candidate.id, purpose: "EXAMINATION_FEE", amountMinor: 1_000_000, provider: "paystack", internalReference: `LVL-PAY-TEST-${crypto.randomUUID().slice(0, 8)}`, status: "SUCCESS", confirmedAt: new Date() },
  });
  const registration = await testPrisma.examRegistration.create({
    data: { candidateId: candidate.id, examId: exam.id, windowId: window.id, paymentId: payment.id, attemptNumber: 1, registeredAt: new Date() },
  });
  const sitting = await startSitting(registration.id, candidate.id);
  await saveSittingAnswer(sitting.id, candidate.id, { questionId: question.id, selectedOptionId: question.options[0]!.id });
  await submitSitting(sitting.id, candidate.id);
  await releaseResults(window.id, staffId, null);
  return { sitting, candidate, window, exam, mod };
}

async function cleanupProgramme(programmeId: string) {
  const exam = await testPrisma.exam.findUnique({ where: { programmeId } });
  if (exam) {
    await testPrisma.examQuestionOption.deleteMany({ where: { question: { examId: exam.id } } });
    await testPrisma.examQuestion.deleteMany({ where: { examId: exam.id } });
    await testPrisma.examWindow.deleteMany({ where: { examId: exam.id } });
    await testPrisma.exam.delete({ where: { id: exam.id } });
  }
  await testPrisma.module.deleteMany({ where: { programmeId } });
  await testPrisma.certificate.deleteMany({ where: { programmeId } });
  await testPrisma.programme.delete({ where: { id: programmeId } });
}

/**
 * Deleting a candidate cascades away their Certificate rows (rule: this
 * project's Certificate.candidateId is onDelete: Cascade), but the
 * CertificateTemplate and MediaAsset rows a test's own staff created
 * (template + artwork, or a certificate's rendered PDF) are RESTRICT-
 * guarded and orphaned by that cascade — they must be cleaned up
 * explicitly, in dependency order, before the staff row itself can go.
 */
async function cleanupRoot(opts: { categoryId: string; staffId: string }) {
  await testPrisma.certificateTemplate.deleteMany({ where: { createdByStaffId: opts.staffId } });
  await testPrisma.mediaAsset.deleteMany({ where: { uploadedByStaffId: opts.staffId } });
  await testPrisma.programmeCategory.delete({ where: { id: opts.categoryId } });
  await testPrisma.staff.delete({ where: { id: opts.staffId } });
}

describe("issueCertificate — idempotent per sitting, even under a retried release (rule 12)", () => {
  it("a second call for the same sitting returns the same row, never a second certificate", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    await seedTemplate(staff.id);
    const { sitting, candidate } = await seedReleasedPassingSitting(programme.id, staff.id);

    const first = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: sitting.id } });

    // Simulates a retried release calling issueCertificate a second time
    // for the exact same sitting.
    const second = await issueCertificate(sitting.id, staff.id);
    expect(second.id).toBe(first.id);
    expect(second.certificateNumber).toBe(first.certificateNumber);

    const count = await testPrisma.certificate.count({ where: { sittingId: sitting.id } });
    expect(count).toBe(1);

    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("refuses to issue when no active template covers the programme's tier", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    // No template seeded here — but prisma/seed.ts's own all-tiers
    // template is real, persistent data in this shared dev database, so
    // it must be switched off for the duration of this test (and
    // restored after) to actually exercise "no active template."
    const activeElsewhere = await testPrisma.certificateTemplate.findMany({ where: { isActive: true } });
    await testPrisma.certificateTemplate.updateMany({ where: { isActive: true }, data: { isActive: false } });

    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0, examQuestionDraw: 1 } });
    const exam = await testPrisma.exam.create({ data: { programmeId: programme.id, status: "PUBLISHED", durationMinutes: 60, passMarkPercent: 50, feeMinor: 1_000_000 } });
    const question = await testPrisma.examQuestion.create({
      data: { examId: exam.id, moduleId: mod.id, type: "OBJECTIVE", status: "APPROVED", prompt: "Q", marks: 2, options: { create: [{ orderIndex: 0, text: "Right", isCorrect: true }] } },
      include: { options: true },
    });
    const window = await testPrisma.examWindow.create({
      data: { examId: exam.id, opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000), registrationDeadline: new Date(Date.now() + 3_600_000) },
    });
    const candidate = await seedCandidate();
    const payment = await testPrisma.payment.create({
      data: { candidateId: candidate.id, purpose: "EXAMINATION_FEE", amountMinor: 1_000_000, provider: "paystack", internalReference: `LVL-PAY-TEST-${crypto.randomUUID().slice(0, 8)}`, status: "SUCCESS", confirmedAt: new Date() },
    });
    const registration = await testPrisma.examRegistration.create({
      data: { candidateId: candidate.id, examId: exam.id, windowId: window.id, paymentId: payment.id, attemptNumber: 1, registeredAt: new Date() },
    });
    const sitting = await startSitting(registration.id, candidate.id);
    await saveSittingAnswer(sitting.id, candidate.id, { questionId: question.id, selectedOptionId: question.options[0]!.id });
    await submitSitting(sitting.id, candidate.id);

    await expect(releaseResults(window.id, staff.id, null)).rejects.toThrow(NoActiveTemplateError);

    await testPrisma.certificateTemplate.updateMany({
      where: { id: { in: activeElsewhere.map((t) => t.id) } },
      data: { isActive: true },
    });
    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("snapshot stability (rule 2) — a programme rename or a new grade band definition changes nothing already issued", () => {
  it("keeps programmeTitle and band exactly as issued", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    await seedTemplate(staff.id);
    const { sitting, candidate } = await seedReleasedPassingSitting(programme.id, staff.id);
    const certificate = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: sitting.id } });
    const originalTitle = certificate.programmeTitle;
    const originalBand = certificate.band;

    await testPrisma.programme.update({ where: { id: programme.id }, data: { title: "A Completely Renamed Programme" } });
    const newBandDefinition = await testPrisma.gradeBandDefinition.create({
      data: { band: "REFER", minPercent: 0, label: "Refer", effectiveFrom: new Date(Date.now() - 86_400_000) },
    });

    const after = await testPrisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
    expect(after.programmeTitle).toBe(originalTitle);
    expect(after.programmeTitle).not.toBe("A Completely Renamed Programme");
    expect(after.band).toBe(originalBand);

    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await testPrisma.gradeBandDefinition.delete({ where: { id: newBandDefinition.id } });
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("revoke vs. supersede — distinct states, distinct verification output (rule 6/7)", () => {
  it("a revoked certificate verifies as revoked with its reason; a superseded one verifies as superseded and names the successor", async () => {
    const { staff, category } = await seedStaffAndCategory();
    // Exam.programmeId is unique (Slice 06) — each sitting needs its own programme.
    const programmeA = await seedProgramme(category.id, staff.id);
    const programmeB = await seedProgramme(category.id, staff.id);
    await seedTemplate(staff.id);
    const { sitting: sittingA, candidate: candidateA } = await seedReleasedPassingSitting(programmeA.id, staff.id);
    const { sitting: sittingB, candidate: candidateB } = await seedReleasedPassingSitting(programmeB.id, staff.id);
    const certA = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: sittingA.id } });
    const certB = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: sittingB.id } });

    const revoked = await revokeCertificate(certA.id, "Assessment integrity finding", staff.id, null);
    expect(revoked.status).toBe("REVOKED");

    const successor = await reissueCertificate(certB.id, "Programme title corrected", staff.id, null);
    const supersededB = await testPrisma.certificate.findUniqueOrThrow({ where: { id: certB.id } });
    expect(supersededB.status).toBe("SUPERSEDED");
    expect(successor.status).toBe("ACTIVE");
    expect(successor.replacesId).toBe(certB.id);
    expect(supersededB.supersededById).toBe(successor.id);

    const verifyRevoked = await verifyCertificate(certA.certificateNumber, "203.0.113.10", null);
    expect(verifyRevoked.result).toBe("revoked");
    expect(verifyRevoked.revokedReason).toBe("Assessment integrity finding");

    const verifySuperseded = await verifyCertificate(certB.certificateNumber, "203.0.113.10", null);
    expect(verifySuperseded.result).toBe("superseded");
    expect(verifySuperseded.successorNumber).toBe(successor.certificateNumber);

    // Re-issuing a REVOKED certificate keeps it revoked (rule 7's "revoked, then replaced" chain) — verified separately here.
    const reissuedFromRevoked = await reissueCertificate(certA.id, "Appeal upheld", staff.id, null);
    const stillRevokedA = await testPrisma.certificate.findUniqueOrThrow({ where: { id: certA.id } });
    expect(stillRevokedA.status).toBe("REVOKED"); // never silently becomes SUPERSEDED
    expect(stillRevokedA.supersededById).toBe(reissuedFromRevoked.id);
    const verifyStillRevoked = await verifyCertificate(certA.certificateNumber, "203.0.113.10", null);
    expect(verifyStillRevoked.result).toBe("revoked");
    expect(verifyStillRevoked.successorNumber).toBe(reissuedFromRevoked.certificateNumber);

    await testPrisma.candidate.delete({ where: { id: candidateA.id } });
    await testPrisma.candidate.delete({ where: { id: candidateB.id } });
    await cleanupProgramme(programmeA.id);
    await cleanupProgramme(programmeB.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("GET /api/certificates/[id]/pdf — signed, expiring, 403 when revoked (rule 8)", () => {
  it("serves the PDF on a valid link, then 403s once the certificate is revoked, even with the same link", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    await seedTemplate(staff.id);
    const { sitting, candidate } = await seedReleasedPassingSitting(programme.id, staff.id);
    const certificate = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: sitting.id } });

    const url = getSignedCertificatePdfUrl(certificate.id);
    const parsed = new URL(`http://localhost:3000${url}`);
    const exp = parsed.searchParams.get("exp");
    const sig = parsed.searchParams.get("sig");
    expect(verifyCertificatePdfLink(certificate.id, exp, sig)).toBe(true);
    expect(verifyCertificatePdfLink(certificate.id, exp, "0".repeat(64))).toBe(false); // tampered signature
    expect(verifyCertificatePdfLink(certificate.id, String(Date.now() - 1000), sig)).toBe(false); // expired

    const okRes = await pdfGet(new NextRequest(`http://localhost:3000${url}`), { params: Promise.resolve({ id: certificate.id }) });
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("content-type")).toBe("application/pdf");

    await revokeCertificate(certificate.id, "Assessment integrity finding", staff.id, null);
    const revokedRes = await pdfGet(new NextRequest(`http://localhost:3000${url}`), { params: Promise.resolve({ id: certificate.id }) });
    expect(revokedRes.status).toBe(403);

    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("GET /api/verify — public, non-enumerable, rate-limited (rule 10)", () => {
  it("returns only the allow-listed fields and never leaks email or phone", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    await seedTemplate(staff.id);
    const { sitting, candidate } = await seedReleasedPassingSitting(programme.id, staff.id);
    const certificate = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: sitting.id } });

    const res = await verifyGet(new NextRequest(`http://localhost:3000/api/verify?number=${certificate.certificateNumber}`, { headers: { "x-forwarded-for": "198.51.100.20" } }));
    const body = await res.json();
    expect(body.result).toBe("valid");
    const keys = Object.keys(body.record);
    expect(keys.sort()).toEqual(["band", "candidateNumber", "certificateNumber", "holderName", "issuedAt", "programmeTitle", "status", "tier"].sort());
    expect(JSON.stringify(body)).not.toContain(candidate.email);

    const lookups = await testPrisma.verificationLookup.findMany({ where: { certificateId: certificate.id } });
    expect(lookups.length).toBeGreaterThanOrEqual(1);
    expect(lookups[0]!.ipHash).not.toBe("198.51.100.20"); // hashed, never stored raw
    expect(lookups[0]!.ipHash).not.toBeNull();

    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });

  it("rate-limits repeated lookups from the same IP without ever 500ing", async () => {
    const ip = `203.0.113.${crypto.randomInt(2, 254)}`;
    let sawRateLimit = false;
    for (let i = 0; i < 25; i++) {
      const res = await verifyGet(new NextRequest(`http://localhost:3000/api/verify?number=LVL-CERT-NOPE-${i}`, { headers: { "x-forwarded-for": ip } }));
      if (res.status === 429) {
        sawRateLimit = true;
        break;
      }
      expect(res.status).toBe(200);
    }
    expect(sawRateLimit).toBe(true);
  });

  it("logs a not_found result for an unknown number without ever throwing", async () => {
    const res = await verifyGet(new NextRequest(`http://localhost:3000/api/verify?number=LVL-CERT-DOES-NOT-EXIST`, { headers: { "x-forwarded-for": "198.51.100.30" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBe("not_found");
    expect(body.record).toBeUndefined();
  });
});

describe("revocation leaves programme access untouched (rule 5)", () => {
  it("the candidate's account, enrolment-adjacent record and credentials list are all unaffected by a revocation", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    await seedTemplate(staff.id);
    const { sitting, candidate } = await seedReleasedPassingSitting(programme.id, staff.id);
    const certificate = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: sitting.id } });

    await revokeCertificate(certificate.id, "Assessment integrity finding", staff.id, null);

    const candidateAfter = await testPrisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(candidateAfter.accountStatus).toBe("ACTIVE"); // never suspended by a credential revocation

    // getCandidateCredentials must still succeed and still SHOW the
    // revoked certificate (never hidden), not throw or 404.
    const credentials = await getCandidateCredentials(candidate.id);
    const shown = credentials.certificates.find((c) => c.id === certificate.id);
    expect(shown).toBeDefined();
    expect(shown!.status).toBe("REVOKED");

    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});

describe("certificate band — a fixed 60%/Distinction, else Pass scale, independent of GradeBandDefinition (Merit never appears on a certificate)", () => {
  it("41-59% earns Pass, 60%+ earns Distinction, and the printed bandLabel/finalPercent both reflect it — never a raw percentage anywhere else", async () => {
    const { staff, category } = await seedStaffAndCategory();
    const programme = await seedProgramme(category.id, staff.id);
    await seedTemplate(staff.id);

    const mod = await testPrisma.module.create({ data: { programmeId: programme.id, weekNumber: 1, title: "Week 1", orderIndex: 0, examQuestionDraw: 2 } });
    // passMarkPercent well below 41 so a 50% scorer still passes — the exam's
    // OWN pass mark stays the real pass/fail gate; the fixed band scale only
    // decides Distinction vs Pass for whoever already cleared it.
    const exam = await testPrisma.exam.create({ data: { programmeId: programme.id, status: "PUBLISHED", durationMinutes: 60, passMarkPercent: 30, feeMinor: 1_000_000 } });
    const q1 = await testPrisma.examQuestion.create({
      data: { examId: exam.id, moduleId: mod.id, type: "OBJECTIVE", status: "APPROVED", prompt: "Q1", marks: 1, options: { create: [{ orderIndex: 0, text: "Right", isCorrect: true }, { orderIndex: 1, text: "Wrong", isCorrect: false }] } },
      include: { options: true },
    });
    const q2 = await testPrisma.examQuestion.create({
      data: { examId: exam.id, moduleId: mod.id, type: "OBJECTIVE", status: "APPROVED", prompt: "Q2", marks: 1, options: { create: [{ orderIndex: 0, text: "Right", isCorrect: true }, { orderIndex: 1, text: "Wrong", isCorrect: false }] } },
      include: { options: true },
    });
    const window = await testPrisma.examWindow.create({
      data: { examId: exam.id, opensAt: new Date(Date.now() - 60_000), closesAt: new Date(Date.now() + 3_600_000), registrationDeadline: new Date(Date.now() + 3_600_000) },
    });

    async function sit(correctCount: 1 | 2) {
      const candidate = await seedCandidate();
      const payment = await testPrisma.payment.create({
        data: { candidateId: candidate.id, purpose: "EXAMINATION_FEE", amountMinor: 1_000_000, provider: "paystack", internalReference: `LVL-PAY-TEST-${crypto.randomUUID().slice(0, 8)}`, status: "SUCCESS", confirmedAt: new Date() },
      });
      const registration = await testPrisma.examRegistration.create({
        data: { candidateId: candidate.id, examId: exam.id, windowId: window.id, paymentId: payment.id, attemptNumber: 1, registeredAt: new Date() },
      });
      const sitting = await startSitting(registration.id, candidate.id);
      await saveSittingAnswer(sitting.id, candidate.id, { questionId: q1.id, selectedOptionId: q1.options[0]!.id }); // always correct
      await saveSittingAnswer(sitting.id, candidate.id, { questionId: q2.id, selectedOptionId: correctCount === 2 ? q2.options[0]!.id : q2.options[1]!.id });
      await submitSitting(sitting.id, candidate.id);
      return { candidate, sitting };
    }

    const passRange = await sit(1); // 1/2 = 50%
    const distinctionRange = await sit(2); // 2/2 = 100%

    await releaseResults(window.id, staff.id, null);

    const passSitting = await testPrisma.sitting.findUniqueOrThrow({ where: { id: passRange.sitting.id } });
    expect(passSitting.totalPercent).toBe(50);
    expect(passSitting.outcome).toBe("PASS"); // cleared the exam's own 30% pass mark
    const passCert = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: passRange.sitting.id } });
    expect(passCert.band).toBe("PASS");
    expect(passCert.finalPercent).toBe(50); // stored for the record, never shown on the certificate itself

    const distinctionCert = await testPrisma.certificate.findUniqueOrThrow({ where: { sittingId: distinctionRange.sitting.id } });
    expect(distinctionCert.band).toBe("DISTINCTION");
    expect(distinctionCert.finalPercent).toBe(100);

    await testPrisma.candidate.deleteMany({ where: { id: { in: [passRange.candidate.id, distinctionRange.candidate.id] } } });
    await cleanupProgramme(programme.id);
    await cleanupRoot({ categoryId: category.id, staffId: staff.id });
  });
});
