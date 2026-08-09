import { describe, it, expect, afterAll } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { confirmPayment } from "@/lib/enrolment-transaction";
import { applyOfflineRecording } from "@/lib/offline-recording";

/**
 * Shared fixture: one staff member, one category, one programme, one
 * intake — reused across this file's describe blocks, each of which
 * creates its own throwaway cohort/candidates/enrolments/payments so the
 * tests don't interfere with each other.
 */
async function seedProgramme(feeMinor = 45_000_000) {
  const staff = await testPrisma.staff.create({
    data: {
      name: "Test Finance Staff",
      email: `enrol-test-${crypto.randomUUID()}@example.com`,
      role: "FINANCE",
      passwordHash: "not-a-real-hash",
    },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `Enrol Test Category ${crypto.randomUUID()}`, slug: `enrol-test-${crypto.randomUUID()}` },
  });
  const programme = await testPrisma.programme.create({
    data: {
      code: `ENR-${crypto.randomUUID().slice(0, 8)}`,
      title: "Enrolment Transaction Test Programme",
      categoryId: category.id,
      tier: "SPECIALIST",
      status: "ACTIVE",
      summary: "test",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      credits: 24,
      feeMinor,
      createdByStaffId: staff.id,
    },
  });
  const intake = await testPrisma.intake.create({
    data: {
      month: "SEPTEMBER",
      year: crypto.randomInt(10_000, 999_999), // distinct per test run to avoid the (month, year) unique clash
      status: "OPEN",
      enrolmentOpensAt: new Date(),
      enrolmentClosesAt: new Date(),
      startsAt: new Date(),
    },
  });
  return { staff, category, programme, intake };
}

async function seedReceiptAsset(staffId: string) {
  return testPrisma.mediaAsset.create({
    data: {
      kind: "document",
      storageKey: `uploads/test-receipt-${crypto.randomUUID()}.pdf`,
      mimeType: "application/pdf",
      bytes: 128,
      originalFilename: "receipt.pdf",
      uploadedByStaffId: staffId,
    },
  });
}

async function seedCandidate() {
  return testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      firstName: "Test",
      lastName: "Candidate",
      email: `enrol-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
}

async function seedPendingPayment(candidateId: string, programmeId: string, intakeId: string, amountMinor: number) {
  const enrolment = await testPrisma.enrolment.create({
    data: { candidateId, programmeId, intakeId, status: "PENDING_PAYMENT" },
  });
  const payment = await testPrisma.payment.create({
    data: {
      candidateId,
      purpose: "PROGRAMME_FEE",
      enrolmentId: enrolment.id,
      amountMinor,
      provider: "paystack",
      internalReference: `LVL-PAY-TEST-${crypto.randomUUID()}`,
      status: "PENDING",
    },
  });
  return { enrolment, payment };
}

describe("confirmPayment — the enrolment transaction", () => {
  describe("candidate number is issued once, on first confirmed payment only", () => {
    it("assigns a number on the first programme and leaves it untouched on a second", async () => {
      const fixtureA = await seedProgramme();
      const fixtureB = await seedProgramme();
      const candidate = await seedCandidate();
      const { payment: paymentA } = await seedPendingPayment(candidate.id, fixtureA.programme.id, fixtureA.intake.id, fixtureA.programme.feeMinor);
      const { payment: paymentB } = await seedPendingPayment(candidate.id, fixtureB.programme.id, fixtureB.intake.id, fixtureB.programme.feeMinor);

      const resultA = await confirmPayment(paymentA.id, { auditAction: "payment.confirmed" });
      expect(resultA.candidateNumberAssigned).toBe(true);

      const afterFirst = await testPrisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
      expect(afterFirst.candidateNumber).toMatch(/^LVL\/\d{4}\/\d{5}$/);

      const resultB = await confirmPayment(paymentB.id, { auditAction: "payment.confirmed" });
      expect(resultB.candidateNumberAssigned).toBe(false);

      const afterSecond = await testPrisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
      expect(afterSecond.candidateNumber).toBe(afterFirst.candidateNumber); // unchanged — never a second number

      await testPrisma.payment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.enrolment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.idCard.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.notification.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.candidate.delete({ where: { id: candidate.id } });
      for (const f of [fixtureA, fixtureB]) {
        await testPrisma.programme.delete({ where: { id: f.programme.id } });
        await testPrisma.programmeCategory.delete({ where: { id: f.category.id } });
        await testPrisma.staff.delete({ where: { id: f.staff.id } });
        await testPrisma.intake.delete({ where: { id: f.intake.id } });
      }
    });

    it("re-running confirmPayment on an already-SUCCESS payment is a no-op (idempotent)", async () => {
      const fixture = await seedProgramme();
      const candidate = await seedCandidate();
      const { payment } = await seedPendingPayment(candidate.id, fixture.programme.id, fixture.intake.id, fixture.programme.feeMinor);

      const first = await confirmPayment(payment.id, { auditAction: "payment.confirmed" });
      expect(first.alreadyConfirmed).toBe(false);
      const numberAfterFirst = (await testPrisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } })).candidateNumber;

      const second = await confirmPayment(payment.id, { auditAction: "payment.confirmed" });
      expect(second.alreadyConfirmed).toBe(true);
      const numberAfterSecond = (await testPrisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } })).candidateNumber;
      expect(numberAfterSecond).toBe(numberAfterFirst);

      await testPrisma.payment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.enrolment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.idCard.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.notification.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.candidate.delete({ where: { id: candidate.id } });
      await testPrisma.programme.delete({ where: { id: fixture.programme.id } });
      await testPrisma.programmeCategory.delete({ where: { id: fixture.category.id } });
      await testPrisma.staff.delete({ where: { id: fixture.staff.id } });
      await testPrisma.intake.delete({ where: { id: fixture.intake.id } });
    });
  });

  describe("cohort capacity is enforced under a row lock (rule 11)", () => {
    it("two concurrent payments for the last place yield one placement, one flagged as unavailable, both payments confirmed", async () => {
      const fixture = await seedProgramme();
      const cohort = await testPrisma.cohort.create({
        data: {
          code: `ENR-COHORT-${crypto.randomUUID().slice(0, 8)}`,
          programmeId: fixture.programme.id,
          intakeId: fixture.intake.id,
          capacity: 1,
        },
      });
      const candidateA = await seedCandidate();
      const candidateB = await seedCandidate();
      // No cohortId at creation — real initiatePayment never sets one; only
      // confirmPayment's step 5 assigns it. Pre-assigning it here would let
      // an unavailable placement fall back to this pre-existing value
      // instead of staying null (confirmPayment's `assignedCohortId ??
      // enrolment.cohortId`), which is exactly the bug this test is for.
      const enrolA = await testPrisma.enrolment.create({
        data: { candidateId: candidateA.id, programmeId: fixture.programme.id, intakeId: fixture.intake.id, status: "PENDING_PAYMENT" },
      });
      const enrolB = await testPrisma.enrolment.create({
        data: { candidateId: candidateB.id, programmeId: fixture.programme.id, intakeId: fixture.intake.id, status: "PENDING_PAYMENT" },
      });
      const paymentA = await testPrisma.payment.create({
        data: { candidateId: candidateA.id, purpose: "PROGRAMME_FEE", enrolmentId: enrolA.id, amountMinor: fixture.programme.feeMinor, provider: "paystack", internalReference: `LVL-PAY-TEST-${crypto.randomUUID()}`, status: "PENDING" },
      });
      const paymentB = await testPrisma.payment.create({
        data: { candidateId: candidateB.id, purpose: "PROGRAMME_FEE", enrolmentId: enrolB.id, amountMinor: fixture.programme.feeMinor, provider: "paystack", internalReference: `LVL-PAY-TEST-${crypto.randomUUID()}`, status: "PENDING" },
      });

      const [resultA, resultB] = await Promise.all([
        confirmPayment(paymentA.id, { auditAction: "payment.confirmed" }),
        confirmPayment(paymentB.id, { auditAction: "payment.confirmed" }),
      ]);

      // Exactly one of the two got the cohort place; the other is flagged,
      // never both placed (that would exceed capacity) and never neither
      // (the money was taken for both).
      const placedCount = [resultA, resultB].filter((r) => r.cohortAssigned).length;
      const unavailableCount = [resultA, resultB].filter((r) => r.cohortUnavailable).length;
      expect(placedCount).toBe(1);
      expect(unavailableCount).toBe(1);

      const finalEnrolments = await testPrisma.enrolment.findMany({ where: { id: { in: [enrolA.id, enrolB.id] } } });
      expect(finalEnrolments.every((e) => e.status === "ACTIVE")).toBe(true); // both confirmed ACTIVE — a placement problem never un-confirms the payment
      const placedEnrolments = finalEnrolments.filter((e) => e.cohortId != null);
      expect(placedEnrolments).toHaveLength(1); // capacity 1 — never both placed

      const finalPayments = await testPrisma.payment.findMany({ where: { id: { in: [paymentA.id, paymentB.id] } } });
      expect(finalPayments.every((p) => p.status === "SUCCESS")).toBe(true); // both payments confirmed regardless of placement outcome

      const cohortUnavailableEvents = await testPrisma.auditEvent.count({ where: { action: "enrolment.cohort_unavailable" } });
      expect(cohortUnavailableEvents).toBeGreaterThanOrEqual(1); // the "admin task" trail

      await testPrisma.payment.deleteMany({ where: { candidateId: { in: [candidateA.id, candidateB.id] } } });
      await testPrisma.enrolment.deleteMany({ where: { candidateId: { in: [candidateA.id, candidateB.id] } } });
      await testPrisma.idCard.deleteMany({ where: { candidateId: { in: [candidateA.id, candidateB.id] } } });
      await testPrisma.notification.deleteMany({ where: { candidateId: { in: [candidateA.id, candidateB.id] } } });
      await testPrisma.candidate.deleteMany({ where: { id: { in: [candidateA.id, candidateB.id] } } });
      await testPrisma.cohort.delete({ where: { id: cohort.id } });
      await testPrisma.programme.delete({ where: { id: fixture.programme.id } });
      await testPrisma.programmeCategory.delete({ where: { id: fixture.category.id } });
      await testPrisma.staff.delete({ where: { id: fixture.staff.id } });
      await testPrisma.intake.delete({ where: { id: fixture.intake.id } });
    });
  });

  describe("amountMinor is a snapshot — never re-derived from the live programme fee (rule 7)", () => {
    it("a fee change after payment does not alter the historic payment's stored amount", async () => {
      const fixture = await seedProgramme(45_000_000);
      const candidate = await seedCandidate();
      const { payment } = await seedPendingPayment(candidate.id, fixture.programme.id, fixture.intake.id, fixture.programme.feeMinor);
      await confirmPayment(payment.id, { auditAction: "payment.confirmed" });

      await testPrisma.programme.update({ where: { id: fixture.programme.id }, data: { feeMinor: 60_000_000 } });

      const historic = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(historic.amountMinor).toBe(45_000_000); // unchanged despite the fee now being 60,000,000

      await testPrisma.payment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.enrolment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.idCard.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.notification.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.candidate.delete({ where: { id: candidate.id } });
      await testPrisma.programme.delete({ where: { id: fixture.programme.id } });
      await testPrisma.programmeCategory.delete({ where: { id: fixture.category.id } });
      await testPrisma.staff.delete({ where: { id: fixture.staff.id } });
      await testPrisma.intake.delete({ where: { id: fixture.intake.id } });
    });
  });

  describe("applyOfflineRecording — the part-payment rule (rule 7/8)", () => {
    it("a short payment is recorded as SUCCESS but leaves the enrolment PENDING_PAYMENT and issues no candidate number", async () => {
      const fixture = await seedProgramme(45_000_000);
      const candidate = await seedCandidate();
      const receipt = await seedReceiptAsset(fixture.staff.id);
      const { payment, enrolment } = await seedPendingPayment(candidate.id, fixture.programme.id, fixture.intake.id, fixture.programme.feeMinor);

      const result = await applyOfflineRecording(
        payment.id,
        {
          amountNaira: 300_000, // short of the 450,000 fee
          offlineReceivedOn: new Date(),
          offlineMode: "BANK_TRANSFER",
          offlineReference: "GTB-TEST-SHORT",
          receiptAssetId: receipt.id,
          reconciliationNote: "Partial payment received, chasing balance.",
        },
        fixture.staff.id,
        null
      );
      expect(result.enrolled).toBe(false);
      expect(result.shortfallMinor).toBe(15_000_000);

      const finalPayment = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(finalPayment.status).toBe("SUCCESS"); // recorded as received
      expect(finalPayment.amountMinor).toBe(30_000_000); // the actual amount received, not the fee

      const finalEnrolment = await testPrisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } });
      expect(finalEnrolment.status).toBe("PENDING_PAYMENT"); // never activated on a part payment

      const finalCandidate = await testPrisma.candidate.findUniqueOrThrow({ where: { id: candidate.id } });
      expect(finalCandidate.candidateNumber).toBeNull(); // no number issued

      await testPrisma.payment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.enrolment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.candidate.delete({ where: { id: candidate.id } });
      await testPrisma.mediaAsset.delete({ where: { id: receipt.id } });
      await testPrisma.programme.delete({ where: { id: fixture.programme.id } });
      await testPrisma.programmeCategory.delete({ where: { id: fixture.category.id } });
      await testPrisma.staff.delete({ where: { id: fixture.staff.id } });
      await testPrisma.intake.delete({ where: { id: fixture.intake.id } });
    });

    it("an overpayment is recorded at the actual amount received, never truncated to the fee, and enrols", async () => {
      const fixture = await seedProgramme(45_000_000);
      const candidate = await seedCandidate();
      const receipt = await seedReceiptAsset(fixture.staff.id);
      const { payment, enrolment } = await seedPendingPayment(candidate.id, fixture.programme.id, fixture.intake.id, fixture.programme.feeMinor);

      const result = await applyOfflineRecording(
        payment.id,
        {
          amountNaira: 470_000, // over the 450,000 fee
          offlineReceivedOn: new Date(),
          offlineMode: "BANK_TRANSFER",
          offlineReference: "GTB-TEST-OVER",
          receiptAssetId: receipt.id,
          reconciliationNote: "Overpaid by 20,000 — confirmed with candidate.",
        },
        fixture.staff.id,
        null
      );
      expect(result.enrolled).toBe(true);

      const finalPayment = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(finalPayment.amountMinor).toBe(47_000_000); // never silently truncated to the fee

      const finalEnrolment = await testPrisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } });
      expect(finalEnrolment.status).toBe("ACTIVE");

      await testPrisma.payment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.enrolment.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.idCard.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.notification.deleteMany({ where: { candidateId: candidate.id } });
      await testPrisma.candidate.delete({ where: { id: candidate.id } });
      await testPrisma.mediaAsset.delete({ where: { id: receipt.id } });
      await testPrisma.programme.delete({ where: { id: fixture.programme.id } });
      await testPrisma.programmeCategory.delete({ where: { id: fixture.category.id } });
      await testPrisma.staff.delete({ where: { id: fixture.staff.id } });
      await testPrisma.intake.delete({ where: { id: fixture.intake.id } });
    });
  });
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
