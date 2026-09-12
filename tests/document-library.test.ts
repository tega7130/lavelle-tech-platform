import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import {
  createDocumentTemplate,
  updateDocumentTemplateMetadata,
  setDocumentTemplateActive,
  deleteDocumentTemplate,
  createDocumentCategory,
  createDiscountCode,
  setDiscountCodeActive,
} from "@/lib/document-library-actions";
import { createDocumentTemplateSchema, updateDocumentTemplateSchema, createDiscountCodeSchema } from "@/lib/validation/document-library";
import { isAcceptedDocumentMimeType, MAX_DOCUMENT_BYTES, effectivePriceMinor } from "@/lib/document-library";

async function seedStaff() {
  return testPrisma.staff.create({
    data: { name: "Test Document Staff", email: `doc-test-${crypto.randomUUID()}@example.com`, role: "CONTENT_MANAGER", passwordHash: "not-a-real-hash" },
  });
}

async function seedCategory(name = `Test Category ${crypto.randomUUID().slice(0, 8)}`) {
  return testPrisma.documentCategory.create({ data: { name, slug: name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") } });
}

async function cleanup(staffId: string, ...documentIds: string[]) {
  await testPrisma.documentTemplate.deleteMany({ where: { id: { in: documentIds } } });
  await testPrisma.staff.delete({ where: { id: staffId } }).catch(() => {});
}

const baseFile = {
  fileType: "application/pdf",
  fileName: "employment-contract.pdf",
  fileBytes: 102_400,
};

function baseInput(categoryId: string, overrides: { description?: string; priceMinor?: number } = {}) {
  return {
    title: "Employment Contract Template",
    categoryId,
    priceMinor: 1_500_000, // ₦15,000
    storageKey: `lavelle/document_library/${crypto.randomUUID()}`,
    ...baseFile,
    ...overrides,
  };
}

describe("createDocumentTemplate", () => {
  it("creates a document template and records an audit event", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const input = baseInput(category.id);
    const document = await createDocumentTemplate(input, staff.id);

    expect(document.title).toBe(input.title);
    expect(document.categoryId).toBe(category.id);
    expect(document.category.id).toBe(category.id);
    expect(document.priceMinor).toBe(1_500_000);
    expect(document.currency).toBe("NGN");
    expect(document.isActive).toBe(true);
    expect(document.purchaseCount).toBe(0);
    expect(document.revenueMinor).toBe(0);
    expect(document.uploadedByStaffId).toBe(staff.id);

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "document_template", subjectId: document.id, action: "document_template.created" },
    });
    expect(event).not.toBeNull();
    expect(event?.actorStaffId).toBe(staff.id);

    await cleanup(staff.id, document.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });

  it("stores an optional description, and null when omitted", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const withDescription = await createDocumentTemplate(baseInput(category.id, { description: "A short description." }), staff.id);
    expect(withDescription.description).toBe("A short description.");

    const withoutDescription = await createDocumentTemplate(baseInput(category.id), staff.id);
    expect(withoutDescription.description).toBeNull();

    await cleanup(staff.id, withDescription.id, withoutDescription.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });

  it("rejects a categoryId that doesn't exist (foreign key constraint)", async () => {
    const staff = await seedStaff();
    await expect(createDocumentTemplate(baseInput(crypto.randomUUID()), staff.id)).rejects.toThrow();
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("stores an optional discountedPriceMinor, and null when omitted", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const onSale = await createDocumentTemplate({ ...baseInput(category.id), discountedPriceMinor: 1_000_000 }, staff.id);
    expect(onSale.discountedPriceMinor).toBe(1_000_000);

    const notOnSale = await createDocumentTemplate(baseInput(category.id), staff.id);
    expect(notOnSale.discountedPriceMinor).toBeNull();

    await cleanup(staff.id, onSale.id, notOnSale.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });
});

describe("updateDocumentTemplateMetadata", () => {
  it("updates title/category/description/price without touching the file", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const otherCategory = await seedCategory();
    const document = await createDocumentTemplate(baseInput(category.id), staff.id);

    const updated = await updateDocumentTemplateMetadata(
      document.id,
      { title: "Revised Employment Contract", categoryId: otherCategory.id, description: "Updated wording.", priceMinor: 2_000_000 },
      staff.id
    );

    expect(updated.title).toBe("Revised Employment Contract");
    expect(updated.categoryId).toBe(otherCategory.id);
    expect(updated.description).toBe("Updated wording.");
    expect(updated.priceMinor).toBe(2_000_000);
    // The file itself is never touched by a metadata-only update.
    expect(updated.storageKey).toBe(document.storageKey);
    expect(updated.fileName).toBe(document.fileName);

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "document_template", subjectId: document.id, action: "document_template.updated" },
    });
    expect(event).not.toBeNull();

    await cleanup(staff.id, document.id);
    await testPrisma.documentCategory.deleteMany({ where: { id: { in: [category.id, otherCategory.id] } } });
  });

  it("sets and then clears discountedPriceMinor", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const document = await createDocumentTemplate(baseInput(category.id), staff.id);

    const onSale = await updateDocumentTemplateMetadata(
      document.id,
      { title: document.title, categoryId: category.id, priceMinor: document.priceMinor, discountedPriceMinor: 1_000_000 },
      staff.id
    );
    expect(onSale.discountedPriceMinor).toBe(1_000_000);

    const cleared = await updateDocumentTemplateMetadata(
      document.id,
      { title: document.title, categoryId: category.id, priceMinor: document.priceMinor, discountedPriceMinor: null },
      staff.id
    );
    expect(cleared.discountedPriceMinor).toBeNull();

    await cleanup(staff.id, document.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });
});

describe("setDocumentTemplateActive", () => {
  it("toggles isActive and records a matching audit event", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const document = await createDocumentTemplate(baseInput(category.id), staff.id);

    const deactivated = await setDocumentTemplateActive(document.id, false, staff.id);
    expect(deactivated.isActive).toBe(false);
    const deactivatedEvent = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "document_template", subjectId: document.id, action: "document_template.deactivated" },
    });
    expect(deactivatedEvent).not.toBeNull();

    const reactivated = await setDocumentTemplateActive(document.id, true, staff.id);
    expect(reactivated.isActive).toBe(true);
    const activatedEvent = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "document_template", subjectId: document.id, action: "document_template.activated" },
    });
    expect(activatedEvent).not.toBeNull();

    await cleanup(staff.id, document.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });
});

describe("deleteDocumentTemplate", () => {
  it("soft-deletes — sets deletedAt and isActive false, the row itself stays — and records an audit event", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const document = await createDocumentTemplate(baseInput(category.id), staff.id);

    const deleted = await deleteDocumentTemplate(document.id, staff.id);
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.isActive).toBe(false);

    const stillThere = await testPrisma.documentTemplate.findUnique({ where: { id: document.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.deletedAt).not.toBeNull();

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "document_template", subjectId: document.id, action: "document_template.deleted" },
    });
    expect(event).not.toBeNull();

    await testPrisma.documentTemplate.delete({ where: { id: document.id } }).catch(() => {});
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });

  it("excludes a deleted document from listDocumentTemplates", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const document = await createDocumentTemplate(baseInput(category.id), staff.id);
    await deleteDocumentTemplate(document.id, staff.id);

    const remaining = await testPrisma.documentTemplate.findMany({ where: { deletedAt: null, id: document.id } });
    expect(remaining).toHaveLength(0);

    await testPrisma.documentTemplate.delete({ where: { id: document.id } }).catch(() => {});
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });

  it("a candidate who already purchased the document keeps their access after it is deleted", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const document = await createDocumentTemplate(baseInput(category.id), staff.id);

    const candidate = await testPrisma.candidate.create({
      data: {
        applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
        firstName: "Test",
        lastName: "Candidate",
        email: `doc-delete-cand-${crypto.randomUUID()}@example.com`,
        passwordHash: "not-a-real-hash",
        acceptedTermsAt: new Date(),
      },
    });
    const payment = await testPrisma.payment.create({
      data: {
        candidateId: candidate.id,
        purpose: "DOCUMENT_PURCHASE",
        amountMinor: document.priceMinor,
        provider: "nomba",
        internalReference: `LVL-PAY-TEST-${crypto.randomUUID().slice(0, 8)}`,
        status: "SUCCESS",
        confirmedAt: new Date(),
      },
    });
    const purchase = await testPrisma.documentPurchase.create({
      data: {
        candidateId: candidate.id,
        documentTemplateId: document.id,
        paymentId: payment.id,
        originalPriceMinor: document.priceMinor,
        amountMinor: document.priceMinor,
        purchasedAt: new Date(),
      },
    });

    // The delete must not throw despite the DocumentPurchase FK referencing this row.
    await expect(deleteDocumentTemplate(document.id, staff.id)).resolves.toBeDefined();

    const stillOwned = await testPrisma.documentPurchase.findUnique({ where: { id: purchase.id } });
    expect(stillOwned).not.toBeNull();
    expect(stillOwned?.purchasedAt).not.toBeNull();

    // The file is still resolvable by id — exactly what a download/view request needs.
    const stillResolvable = await testPrisma.documentTemplate.findUnique({ where: { id: document.id } });
    expect(stillResolvable?.storageKey).toBe(document.storageKey);

    await testPrisma.documentPurchase.delete({ where: { id: purchase.id } });
    await testPrisma.payment.delete({ where: { id: payment.id } });
    await testPrisma.candidate.delete({ where: { id: candidate.id } });
    await testPrisma.documentTemplate.delete({ where: { id: document.id } }).catch(() => {});
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });
});

describe("createDocumentCategory", () => {
  it("creates a category, slugified, and records an audit event", async () => {
    const staff = await seedStaff();
    const name = `Non-Disclosure ${crypto.randomUUID().slice(0, 6)}`;
    const category = await createDocumentCategory(name, staff.id);

    expect(category.name).toBe(name);
    expect(category.slug).toBeTruthy();

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "document_category", subjectId: category.id, action: "document_category.created" },
    });
    expect(event).not.toBeNull();

    await testPrisma.documentCategory.delete({ where: { id: category.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("is case-insensitively deduped — a near-duplicate name returns the existing row instead of creating one", async () => {
    const staff = await seedStaff();
    const name = `Franchise Agreements ${crypto.randomUUID().slice(0, 6)}`;
    const first = await createDocumentCategory(name, staff.id);
    const second = await createDocumentCategory(name.toUpperCase(), staff.id);

    expect(second.id).toBe(first.id);
    const count = await testPrisma.documentCategory.count({ where: { name: { equals: name, mode: "insensitive" } } });
    expect(count).toBe(1);

    await testPrisma.documentCategory.delete({ where: { id: first.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("rejects an empty/whitespace name", async () => {
    const staff = await seedStaff();
    await expect(createDocumentCategory("   ", staff.id)).rejects.toThrow();
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });
});

describe("createDiscountCode", () => {
  function code() {
    return `DISC${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  it("creates a PERCENT code and records an audit event", async () => {
    const staff = await seedStaff();
    const created = await createDiscountCode({ code: code(), type: "PERCENT", value: 20 }, staff.id);

    expect(created.type).toBe("PERCENT");
    expect(created.value).toBe(20);
    expect(created.isActive).toBe(true);
    expect(created.redemptionCount).toBe(0);
    expect(created.expiresAt).toBeNull();
    expect(created.maxRedemptions).toBeNull();

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "discount_code", subjectId: created.id, action: "discount_code.created" },
    });
    expect(event).not.toBeNull();
    expect(event?.actorStaffId).toBe(staff.id);

    await testPrisma.discountCode.delete({ where: { id: created.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("creates a FIXED code with an expiry and a redemption cap", async () => {
    const staff = await seedStaff();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    const created = await createDiscountCode({ code: code(), type: "FIXED", value: 200_000, expiresAt, maxRedemptions: 10 }, staff.id);

    expect(created.type).toBe("FIXED");
    expect(created.value).toBe(200_000);
    expect(created.expiresAt?.getTime()).toBe(expiresAt.getTime());
    expect(created.maxRedemptions).toBe(10);

    await testPrisma.discountCode.delete({ where: { id: created.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("applies to every document when documentTemplateIds is omitted (the default)", async () => {
    const staff = await seedStaff();
    const created = await createDiscountCode({ code: code(), type: "PERCENT", value: 20 }, staff.id);
    expect(created.documentScopes).toEqual([]);

    await testPrisma.discountCode.delete({ where: { id: created.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("scopes a code to specific documents when documentTemplateIds is given", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const document = await createDocumentTemplate(baseInput(category.id), staff.id);

    const created = await createDiscountCode({ code: code(), type: "PERCENT", value: 20, documentTemplateIds: [document.id] }, staff.id);
    expect(created.documentScopes).toHaveLength(1);
    expect(created.documentScopes[0].documentTemplateId).toBe(document.id);

    await testPrisma.discountCode.delete({ where: { id: created.id } });
    await cleanup(staff.id, document.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
  });

  it("rejects a duplicate code, case-insensitively", async () => {
    const staff = await seedStaff();
    const c = code();
    const created = await createDiscountCode({ code: c, type: "PERCENT", value: 10 }, staff.id);

    await expect(createDiscountCode({ code: c.toLowerCase(), type: "PERCENT", value: 15 }, staff.id)).rejects.toThrow();

    await testPrisma.discountCode.delete({ where: { id: created.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });
});

describe("setDiscountCodeActive", () => {
  it("deactivates and reactivates, recording an audit event each time", async () => {
    const staff = await seedStaff();
    const created = await createDiscountCode({ code: `DISC${crypto.randomUUID().slice(0, 8).toUpperCase()}`, type: "PERCENT", value: 25 }, staff.id);

    const deactivated = await setDiscountCodeActive(created.id, false, staff.id);
    expect(deactivated.isActive).toBe(false);
    const deactivatedEvent = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "discount_code", subjectId: created.id, action: "discount_code.deactivated" },
    });
    expect(deactivatedEvent).not.toBeNull();

    const reactivated = await setDiscountCodeActive(created.id, true, staff.id);
    expect(reactivated.isActive).toBe(true);
    const reactivatedEvent = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "discount_code", subjectId: created.id, action: "discount_code.activated" },
    });
    expect(reactivatedEvent).not.toBeNull();

    await testPrisma.discountCode.delete({ where: { id: created.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });
});

describe("createDiscountCodeSchema validation", () => {
  it("accepts a valid PERCENT code", () => {
    const result = createDiscountCodeSchema.parse({ code: "WELCOME20", type: "PERCENT", value: "20" });
    expect(result.value).toBe(20);
  });

  it("accepts a valid FIXED code", () => {
    const result = createDiscountCodeSchema.parse({ code: "TAKE2000", type: "FIXED", value: "2000" });
    expect(result.value).toBe(2000);
  });

  it("rejects a percent value over 100", () => {
    expect(() => createDiscountCodeSchema.parse({ code: "TOOMUCH", type: "PERCENT", value: "150" })).toThrow();
  });

  it("allows a fixed value over 100 (it's naira, not a percent)", () => {
    expect(() => createDiscountCodeSchema.parse({ code: "BIGFIXED", type: "FIXED", value: "150000" })).not.toThrow();
  });

  it("rejects a non-positive value", () => {
    expect(() => createDiscountCodeSchema.parse({ code: "FREEBIE", type: "PERCENT", value: "0" })).toThrow();
  });

  it("rejects a code with invalid characters", () => {
    expect(() => createDiscountCodeSchema.parse({ code: "welcome 20!", type: "PERCENT", value: "20" })).toThrow();
  });

  it("rejects a code shorter than 3 characters", () => {
    expect(() => createDiscountCodeSchema.parse({ code: "AB", type: "PERCENT", value: "20" })).toThrow();
  });

  it("does not require expiresAt or maxRedemptions", () => {
    const result = createDiscountCodeSchema.parse({ code: "NOEXPIRY", type: "PERCENT", value: "20" });
    expect(result.expiresAt).toBeUndefined();
    expect(result.maxRedemptions).toBeUndefined();
  });
});

describe("createDocumentTemplateSchema validation", () => {
  const validBase = {
    title: "Employment Contract Template",
    categoryId: "some-category-id",
    priceNaira: "15000",
    storageKey: "lavelle/document_library/abc123",
    fileType: "application/pdf",
    fileName: "contract.pdf",
    fileBytes: 1024,
  };

  it("accepts valid input and converts priceNaira to a number", () => {
    const result = createDocumentTemplateSchema.parse(validBase);
    expect(result.priceNaira).toBe(15000);
  });

  it("rejects a missing title", () => {
    expect(() => createDocumentTemplateSchema.parse({ ...validBase, title: "" })).toThrow();
  });

  it("rejects an empty categoryId", () => {
    expect(() => createDocumentTemplateSchema.parse({ ...validBase, categoryId: "" })).toThrow();
  });

  it("rejects a negative price", () => {
    expect(() => createDocumentTemplateSchema.parse({ ...validBase, priceNaira: "-1" })).toThrow();
  });

  it("accepts a zero price (free template)", () => {
    expect(() => createDocumentTemplateSchema.parse({ ...validBase, priceNaira: "0" })).not.toThrow();
  });

  it("rejects a non-numeric price", () => {
    expect(() => createDocumentTemplateSchema.parse({ ...validBase, priceNaira: "free" })).toThrow();
  });

  it("does not require discountedPriceNaira", () => {
    expect(() => createDocumentTemplateSchema.parse(validBase)).not.toThrow();
  });

  it("accepts discountedPriceNaira when lower than priceNaira", () => {
    const result = createDocumentTemplateSchema.parse({ ...validBase, discountedPriceNaira: "10000" });
    expect(result.discountedPriceNaira).toBe(10000);
  });

  it("rejects discountedPriceNaira equal to or higher than priceNaira", () => {
    expect(() => createDocumentTemplateSchema.parse({ ...validBase, discountedPriceNaira: "15000" })).toThrow();
    expect(() => createDocumentTemplateSchema.parse({ ...validBase, discountedPriceNaira: "20000" })).toThrow();
  });
});

describe("updateDocumentTemplateSchema validation", () => {
  it("does not require file fields", () => {
    const result = updateDocumentTemplateSchema.parse({
      title: "Renamed",
      categoryId: "some-category-id",
      priceNaira: "500",
    });
    expect(result.title).toBe("Renamed");
  });

  it("rejects discountedPriceNaira equal to or higher than priceNaira", () => {
    expect(() =>
      updateDocumentTemplateSchema.parse({ title: "Renamed", categoryId: "some-category-id", priceNaira: "500", discountedPriceNaira: "500" })
    ).toThrow();
  });
});

describe("isAcceptedDocumentMimeType / MAX_DOCUMENT_BYTES", () => {
  it("accepts PDF and DOCX, rejects anything else", () => {
    expect(isAcceptedDocumentMimeType("application/pdf")).toBe(true);
    expect(isAcceptedDocumentMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(isAcceptedDocumentMimeType("image/png")).toBe(false);
    expect(isAcceptedDocumentMimeType("application/msword")).toBe(false);
  });

  it("defines a positive, sane upload ceiling", () => {
    expect(MAX_DOCUMENT_BYTES).toBeGreaterThan(0);
  });
});

describe("effectivePriceMinor", () => {
  it("is the discounted price when one is set — this is what gets charged", () => {
    expect(effectivePriceMinor({ priceMinor: 2_000_000, discountedPriceMinor: 1_000_000 })).toBe(1_000_000);
  });

  it("falls back to the selling price when there is no discounted price", () => {
    expect(effectivePriceMinor({ priceMinor: 1_500_000, discountedPriceMinor: null })).toBe(1_500_000);
  });
});
