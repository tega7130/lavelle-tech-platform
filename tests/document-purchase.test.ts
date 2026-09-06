import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import {
  validateAndComputeDiscount,
  resolveDocumentPurchaseForPayment,
  confirmDocumentPurchase,
  AlreadyOwnedError,
  PurchaseInProgressError,
} from "@/lib/document-purchase";

async function seedStaff() {
  return testPrisma.staff.create({
    data: { name: "Doc Purchase Test Staff", email: `doc-purchase-staff-${crypto.randomUUID()}@example.com`, role: "CONTENT_MANAGER", passwordHash: "not-a-real-hash" },
  });
}

async function seedCandidate() {
  return testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      firstName: "Test",
      lastName: "Candidate",
      email: `doc-purchase-cand-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
}

async function seedDocument(staffId: string, priceMinor = 1_000_000) {
  const category = await testPrisma.documentCategory.create({
    data: { name: `Test Category ${crypto.randomUUID().slice(0, 8)}`, slug: `TEST_${crypto.randomUUID().slice(0, 8)}` },
  });
  return testPrisma.documentTemplate.create({
    data: {
      title: "Test Template",
      categoryId: category.id,
      priceMinor,
      storageKey: `lavelle/document_library/${crypto.randomUUID()}`,
      fileType: "application/pdf",
      fileName: "test.pdf",
      fileBytes: 1024,
      uploadedByStaffId: staffId,
    },
  });
}

async function cleanup(opts: { staffId: string; candidateId: string; documentId: string }) {
  await testPrisma.documentPurchase.deleteMany({ where: { candidateId: opts.candidateId } });
  await testPrisma.payment.deleteMany({ where: { candidateId: opts.candidateId } });
  const document = await testPrisma.documentTemplate.findUnique({ where: { id: opts.documentId } });
  await testPrisma.documentTemplate.delete({ where: { id: opts.documentId } }).catch(() => {});
  if (document) await testPrisma.documentCategory.delete({ where: { id: document.categoryId } }).catch(() => {});
  await testPrisma.candidate.delete({ where: { id: opts.candidateId } }).catch(() => {});
  await testPrisma.staff.delete({ where: { id: opts.staffId } }).catch(() => {});
}

const noDiscount = (priceMinor: number) => ({ originalPriceMinor: priceMinor, discountMinor: 0, discountCodeId: null, amountMinor: priceMinor });

describe("validateAndComputeDiscount", () => {
  it("computes a percent discount", async () => {
    const code = await testPrisma.discountCode.create({ data: { code: `PCT${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 20 } });
    const result = await validateAndComputeDiscount(1_000_000, code.code);
    expect(result).toMatchObject({ valid: true, discountMinor: 200_000, finalAmountMinor: 800_000 });
    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });

  it("computes a fixed discount, capped at the price so the final amount never goes negative", async () => {
    const code = await testPrisma.discountCode.create({ data: { code: `FIX${crypto.randomUUID().slice(0, 6)}`, type: "FIXED", value: 5_000_000 } });
    const result = await validateAndComputeDiscount(1_000_000, code.code);
    expect(result).toMatchObject({ valid: true, discountMinor: 1_000_000, finalAmountMinor: 0 });
    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });

  it("matches the code case-insensitively (citext)", async () => {
    const code = await testPrisma.discountCode.create({ data: { code: `MiXeD${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 10 } });
    const result = await validateAndComputeDiscount(1_000_000, code.code.toLowerCase());
    expect(result.valid).toBe(true);
    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });

  it("rejects a nonexistent code", async () => {
    const result = await validateAndComputeDiscount(1_000_000, `NOPE${crypto.randomUUID()}`);
    expect(result.valid).toBe(false);
  });

  it("rejects an inactive code", async () => {
    const code = await testPrisma.discountCode.create({ data: { code: `INACT${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 10, isActive: false } });
    expect((await validateAndComputeDiscount(1_000_000, code.code)).valid).toBe(false);
    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });

  it("rejects an expired code", async () => {
    const code = await testPrisma.discountCode.create({
      data: { code: `EXP${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 10, expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await validateAndComputeDiscount(1_000_000, code.code)).valid).toBe(false);
    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });

  it("rejects a code that has already hit its redemption cap", async () => {
    const code = await testPrisma.discountCode.create({
      data: { code: `CAP${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 10, maxRedemptions: 1, redemptionCount: 1 },
    });
    expect((await validateAndComputeDiscount(1_000_000, code.code)).valid).toBe(false);
    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });

  it("rejects an empty/whitespace code", async () => {
    expect((await validateAndComputeDiscount(1_000_000, "   ")).valid).toBe(false);
  });
});

describe("resolveDocumentPurchaseForPayment", () => {
  it("creates a PENDING payment and a linked DocumentPurchase with purchasedAt null", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id);

    const { purchase, payment } = await resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor));

    expect(payment.status).toBe("PENDING");
    expect(payment.purpose).toBe("DOCUMENT_PURCHASE");
    expect(purchase.purchasedAt).toBeNull();
    expect(purchase.paymentId).toBe(payment.id);

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });

  it("reuses the same DocumentPurchase row on retry after a FAILED payment, attaching a fresh Payment", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id);

    const first = await resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor));
    await testPrisma.payment.update({ where: { id: first.payment.id }, data: { status: "FAILED", failedAt: new Date() } });

    const second = await resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor));

    expect(second.purchase.id).toBe(first.purchase.id);
    expect(second.payment.id).not.toBe(first.payment.id);

    const allPurchases = await testPrisma.documentPurchase.findMany({ where: { candidateId: candidate.id, documentTemplateId: document.id } });
    expect(allPurchases).toHaveLength(1);

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });

  it("throws PurchaseInProgressError while a payment is still PENDING", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id);

    await resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor));

    await expect(resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor))).rejects.toThrow(PurchaseInProgressError);

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });

  it("throws AlreadyOwnedError once purchasedAt is set", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id);

    const { payment } = await resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor));
    await confirmDocumentPurchase(payment.id);

    await expect(resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor))).rejects.toThrow(AlreadyOwnedError);

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });
});

describe("confirmDocumentPurchase", () => {
  it("sets purchasedAt, marks the payment SUCCESS, increments purchaseCount/revenueMinor, and records an audit event", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id, 2_000_000);

    const { payment } = await resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor));
    const result = await confirmDocumentPurchase(payment.id);

    expect(result.alreadyConfirmed).toBe(false);
    expect(result.amountMinor).toBe(2_000_000);

    const purchase = await testPrisma.documentPurchase.findUniqueOrThrow({ where: { id: result.purchaseId } });
    expect(purchase.purchasedAt).not.toBeNull();

    const updatedDocument = await testPrisma.documentTemplate.findUniqueOrThrow({ where: { id: document.id } });
    expect(updatedDocument.purchaseCount).toBe(1);
    expect(updatedDocument.revenueMinor).toBe(2_000_000);

    const updatedPayment = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("SUCCESS");

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "document_purchase", subjectId: purchase.id, action: "document_purchase.confirmed" },
    });
    expect(event).not.toBeNull();

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });

  it("is idempotent — a retried confirmation never double-counts revenue or purchaseCount", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id, 1_500_000);

    const { payment } = await resolveDocumentPurchaseForPayment(candidate.id, document.id, noDiscount(document.priceMinor));
    await confirmDocumentPurchase(payment.id);
    const second = await confirmDocumentPurchase(payment.id);

    expect(second.alreadyConfirmed).toBe(true);

    const updatedDocument = await testPrisma.documentTemplate.findUniqueOrThrow({ where: { id: document.id } });
    expect(updatedDocument.purchaseCount).toBe(1);
    expect(updatedDocument.revenueMinor).toBe(1_500_000);

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });

  it("increments the discount code's redemptionCount only once a purchase is actually confirmed", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id, 1_000_000);
    const code = await testPrisma.discountCode.create({ data: { code: `REDEEM${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 10 } });

    const { payment } = await resolveDocumentPurchaseForPayment(candidate.id, document.id, {
      originalPriceMinor: 1_000_000,
      discountMinor: 100_000,
      discountCodeId: code.id,
      amountMinor: 900_000,
    });

    expect((await testPrisma.discountCode.findUniqueOrThrow({ where: { id: code.id } })).redemptionCount).toBe(0);

    await confirmDocumentPurchase(payment.id);

    expect((await testPrisma.discountCode.findUniqueOrThrow({ where: { id: code.id } })).redemptionCount).toBe(1);

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });
});
