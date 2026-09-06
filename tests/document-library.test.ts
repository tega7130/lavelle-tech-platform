import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import {
  createDocumentTemplate,
  updateDocumentTemplateMetadata,
  setDocumentTemplateActive,
  deleteDocumentTemplate,
} from "@/lib/document-library-actions";
import { createDocumentTemplateSchema, updateDocumentTemplateSchema } from "@/lib/validation/document-library";
import { isAcceptedDocumentMimeType, MAX_DOCUMENT_BYTES } from "@/lib/document-library";

async function seedStaff() {
  return testPrisma.staff.create({
    data: { name: "Test Document Staff", email: `doc-test-${crypto.randomUUID()}@example.com`, role: "CONTENT_MANAGER", passwordHash: "not-a-real-hash" },
  });
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

function baseInput(overrides: { description?: string; category?: string; priceMinor?: number } = {}) {
  return {
    title: "Employment Contract Template",
    category: "EMPLOYMENT",
    priceMinor: 1_500_000, // ₦15,000
    storageKey: `lavelle/document_library/${crypto.randomUUID()}`,
    ...baseFile,
    ...overrides,
  };
}

describe("createDocumentTemplate", () => {
  it("creates a document template and records an audit event", async () => {
    const staff = await seedStaff();
    const input = baseInput();
    const document = await createDocumentTemplate(input, staff.id);

    expect(document.title).toBe(input.title);
    expect(document.category).toBe("EMPLOYMENT");
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
  });

  it("stores an optional description, and null when omitted", async () => {
    const staff = await seedStaff();
    const withDescription = await createDocumentTemplate(baseInput({ description: "A short description." }), staff.id);
    expect(withDescription.description).toBe("A short description.");

    const withoutDescription = await createDocumentTemplate(baseInput(), staff.id);
    expect(withoutDescription.description).toBeNull();

    await cleanup(staff.id, withDescription.id, withoutDescription.id);
  });
});

describe("updateDocumentTemplateMetadata", () => {
  it("updates title/category/description/price without touching the file", async () => {
    const staff = await seedStaff();
    const document = await createDocumentTemplate(baseInput(), staff.id);

    const updated = await updateDocumentTemplateMetadata(
      document.id,
      { title: "Revised Employment Contract", category: "CONTRACTS", description: "Updated wording.", priceMinor: 2_000_000 },
      staff.id
    );

    expect(updated.title).toBe("Revised Employment Contract");
    expect(updated.category).toBe("CONTRACTS");
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
  });
});

describe("setDocumentTemplateActive", () => {
  it("toggles isActive and records a matching audit event", async () => {
    const staff = await seedStaff();
    const document = await createDocumentTemplate(baseInput(), staff.id);

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
  });
});

describe("deleteDocumentTemplate", () => {
  it("records an audit event before removing the row", async () => {
    const staff = await seedStaff();
    const document = await createDocumentTemplate(baseInput(), staff.id);

    await deleteDocumentTemplate(document.id, staff.id);

    const gone = await testPrisma.documentTemplate.findUnique({ where: { id: document.id } });
    expect(gone).toBeNull();

    const event = await testPrisma.auditEvent.findFirst({
      where: { subjectType: "document_template", subjectId: document.id, action: "document_template.deleted" },
    });
    expect(event).not.toBeNull();

    await testPrisma.staff.delete({ where: { id: staff.id } }).catch(() => {});
  });
});

describe("createDocumentTemplateSchema validation", () => {
  const validBase = {
    title: "Employment Contract Template",
    category: "EMPLOYMENT",
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

  it("rejects a category outside the fixed list", () => {
    expect(() => createDocumentTemplateSchema.parse({ ...validBase, category: "NOT_A_CATEGORY" })).toThrow();
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
});

describe("updateDocumentTemplateSchema validation", () => {
  it("does not require file fields", () => {
    const result = updateDocumentTemplateSchema.parse({
      title: "Renamed",
      category: "OTHER",
      priceNaira: "500",
    });
    expect(result.title).toBe("Renamed");
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
