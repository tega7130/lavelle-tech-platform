import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { getPublicDocumentTemplates, getPublicDocumentCategories, getActiveLibraryPromotion } from "@/lib/public-document-library-reads";
import { setComplementaryTemplates } from "@/lib/document-library-actions";

async function seedStaff() {
  return testPrisma.staff.create({
    data: { name: "Public Library Test Staff", email: `public-lib-staff-${crypto.randomUUID()}@example.com`, role: "CONTENT_MANAGER", passwordHash: "not-a-real-hash" },
  });
}

async function seedCategory(name = `Test Category ${crypto.randomUUID().slice(0, 8)}`) {
  return testPrisma.documentCategory.create({ data: { name, slug: name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") } });
}

async function seedDocument(
  staffId: string,
  categoryId: string,
  overrides: Partial<{ title: string; priceMinor: number; discountedPriceMinor: number | null; isActive: boolean; deletedAt: Date | null; description: string | null }> = {}
) {
  return testPrisma.documentTemplate.create({
    data: {
      title: overrides.title ?? "Employment Contract Template",
      categoryId,
      description: overrides.description ?? "A description mentioning employment.",
      priceMinor: overrides.priceMinor ?? 1_500_000,
      discountedPriceMinor: overrides.discountedPriceMinor ?? null,
      storageKey: `lavelle/document_library/${crypto.randomUUID()}`,
      fileType: "application/pdf",
      fileName: "employment-contract.pdf",
      fileBytes: 102_400,
      uploadedByStaffId: staffId,
      isActive: overrides.isActive ?? true,
      deletedAt: overrides.deletedAt ?? null,
    },
  });
}

async function cleanupDocuments(...documentIds: string[]) {
  await testPrisma.documentTemplateRelation.deleteMany({ where: { OR: [{ documentTemplateId: { in: documentIds } }, { relatedDocumentTemplateId: { in: documentIds } }] } });
  await testPrisma.documentTemplate.deleteMany({ where: { id: { in: documentIds } } });
}

describe("getPublicDocumentTemplates", () => {
  it("returns only active, non-deleted documents, with only public-safe fields", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const active = await seedDocument(staff.id, category.id, { title: "Public NDA" });
    const inactive = await seedDocument(staff.id, category.id, { title: "Inactive Doc", isActive: false });
    const deleted = await seedDocument(staff.id, category.id, { title: "Deleted Doc", deletedAt: new Date() });

    const results = await getPublicDocumentTemplates();
    const ids = results.map((d) => d.id);

    expect(ids).toContain(active.id);
    expect(ids).not.toContain(inactive.id);
    expect(ids).not.toContain(deleted.id);

    const found = results.find((d) => d.id === active.id)!;
    expect(found.title).toBe("Public NDA");
    expect(found.fileFormat).toBe("PDF");
    expect(found.priceMinor).toBe(1_500_000);
    expect(found.category.name).toBe(category.name);
    expect(found.complementaryIds).toEqual([]);

    // The select list IS the enforcement — no restricted field should ever
    // exist on the returned object, not even as undefined-but-present.
    expect(found).not.toHaveProperty("storageKey");
    expect(found).not.toHaveProperty("fileName");
    expect(found).not.toHaveProperty("fileBytes");
    expect(found).not.toHaveProperty("purchaseCount");
    expect(found).not.toHaveProperty("revenueMinor");
    expect(found).not.toHaveProperty("uploadedByStaffId");
    expect(found).not.toHaveProperty("isActive");
    expect(found).not.toHaveProperty("deletedAt");

    await cleanupDocuments(active.id, inactive.id, deleted.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("includes discountedPriceMinor when set, and null when not, computing effectivePriceMinor either way", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const onSale = await seedDocument(staff.id, category.id, { title: "On Sale", priceMinor: 2_000_000, discountedPriceMinor: 1_000_000 });
    const notOnSale = await seedDocument(staff.id, category.id, { title: "Not On Sale", priceMinor: 1_500_000 });

    const results = await getPublicDocumentTemplates();
    const onSaleFound = results.find((d) => d.id === onSale.id);
    expect(onSaleFound?.discountedPriceMinor).toBe(1_000_000);
    expect(onSaleFound?.effectivePriceMinor).toBe(1_000_000);

    const notOnSaleFound = results.find((d) => d.id === notOnSale.id);
    expect(notOnSaleFound?.discountedPriceMinor).toBeNull();
    expect(notOnSaleFound?.effectivePriceMinor).toBe(1_500_000);

    await cleanupDocuments(onSale.id, notOnSale.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("annotates each document with the ids of its currently-listed complementary templates", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const main = await seedDocument(staff.id, category.id, { title: "NDA" });
    const related = await seedDocument(staff.id, category.id, { title: "Service Agreement" });
    const inactiveRelated = await seedDocument(staff.id, category.id, { title: "Delisted Related", isActive: false });

    await setComplementaryTemplates(main.id, [related.id, inactiveRelated.id], staff.id);

    const results = await getPublicDocumentTemplates();
    const found = results.find((d) => d.id === main.id)!;
    expect(found.complementaryIds).toEqual([related.id]);

    await cleanupDocuments(main.id, related.id, inactiveRelated.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });
});

describe("getPublicDocumentCategories", () => {
  it("counts only active, non-deleted documents and omits empty categories", async () => {
    const staff = await seedStaff();
    const withDocs = await seedCategory();
    const empty = await seedCategory();
    const doc1 = await seedDocument(staff.id, withDocs.id);
    const doc2 = await seedDocument(staff.id, withDocs.id);
    const inactiveDoc = await seedDocument(staff.id, withDocs.id, { isActive: false });

    const categories = await getPublicDocumentCategories();
    const found = categories.find((c) => c.id === withDocs.id);
    expect(found?.count).toBe(2);
    expect(categories.some((c) => c.id === empty.id)).toBe(false);

    await cleanupDocuments(doc1.id, doc2.id, inactiveDoc.id);
    await testPrisma.documentCategory.delete({ where: { id: withDocs.id } });
    await testPrisma.documentCategory.delete({ where: { id: empty.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });
});

describe("getActiveLibraryPromotion", () => {
  it("returns null when there is no active discount code", async () => {
    expect(await getActiveLibraryPromotion()).toBeNull();
  });

  it("returns null when the only codes are inactive, expired or exhausted", async () => {
    const inactive = await testPrisma.discountCode.create({ data: { code: `PROMOINACT${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 10, isActive: false } });
    const expired = await testPrisma.discountCode.create({
      data: { code: `PROMOEXP${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 10, expiresAt: new Date(Date.now() - 1000) },
    });
    const exhausted = await testPrisma.discountCode.create({
      data: { code: `PROMOCAP${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 10, maxRedemptions: 1, redemptionCount: 1 },
    });

    expect(await getActiveLibraryPromotion()).toBeNull();

    await testPrisma.discountCode.deleteMany({ where: { id: { in: [inactive.id, expired.id, exhausted.id] } } });
  });

  it("surfaces a naira headline for the best active FIXED code, without ever including the code string", async () => {
    const code = await testPrisma.discountCode.create({ data: { code: `PROMOFIX${crypto.randomUUID().slice(0, 6)}`, type: "FIXED", value: 500_000 } });

    const promo = await getActiveLibraryPromotion();
    expect(promo).not.toBeNull();
    expect(promo?.headline).toContain("₦5,000");
    expect(promo?.headline).not.toContain(code.code);

    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });

  it("falls back to a percent headline when only PERCENT codes are active", async () => {
    const code = await testPrisma.discountCode.create({ data: { code: `PROMOPCT${crypto.randomUUID().slice(0, 6)}`, type: "PERCENT", value: 25 } });

    const promo = await getActiveLibraryPromotion();
    expect(promo?.headline).toContain("25%");

    await testPrisma.discountCode.delete({ where: { id: code.id } });
  });
});

describe("setComplementaryTemplates", () => {
  it("creates relation rows and records an audit event", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const main = await seedDocument(staff.id, category.id);
    const related = await seedDocument(staff.id, category.id);

    const result = await setComplementaryTemplates(main.id, [related.id], staff.id);
    expect(result).toEqual([related.id]);

    const rows = await testPrisma.documentTemplateRelation.findMany({ where: { documentTemplateId: main.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].relatedDocumentTemplateId).toBe(related.id);

    const event = await testPrisma.auditEvent.findFirst({ where: { subjectType: "document_template", subjectId: main.id, action: "document_template.complementary_updated" } });
    expect(event).not.toBeNull();

    await cleanupDocuments(main.id, related.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("replaces the full set on a second call, rather than adding to it", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const main = await seedDocument(staff.id, category.id);
    const first = await seedDocument(staff.id, category.id);
    const second = await seedDocument(staff.id, category.id);

    await setComplementaryTemplates(main.id, [first.id], staff.id);
    await setComplementaryTemplates(main.id, [second.id], staff.id);

    const rows = await testPrisma.documentTemplateRelation.findMany({ where: { documentTemplateId: main.id } });
    expect(rows.map((r) => r.relatedDocumentTemplateId)).toEqual([second.id]);

    await cleanupDocuments(main.id, first.id, second.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });

  it("excludes a self-reference", async () => {
    const staff = await seedStaff();
    const category = await seedCategory();
    const main = await seedDocument(staff.id, category.id);

    const result = await setComplementaryTemplates(main.id, [main.id], staff.id);
    expect(result).toEqual([]);

    await cleanupDocuments(main.id);
    await testPrisma.documentCategory.delete({ where: { id: category.id } });
    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });
});
