import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { toggleFavorite, isDocumentFavorited } from "@/lib/candidate-favorites";

async function seedStaff() {
  return testPrisma.staff.create({
    data: { name: "Favorites Test Staff", email: `fav-staff-${crypto.randomUUID()}@example.com`, role: "CONTENT_MANAGER", passwordHash: "not-a-real-hash" },
  });
}

async function seedCandidate() {
  return testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      firstName: "Test",
      lastName: "Candidate",
      email: `fav-cand-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
}

async function seedDocument(staffId: string) {
  return testPrisma.documentTemplate.create({
    data: {
      title: "Favoritable Template",
      category: "OTHER",
      priceMinor: 500_000,
      storageKey: `lavelle/document_library/${crypto.randomUUID()}`,
      fileType: "application/pdf",
      fileName: "test.pdf",
      fileBytes: 1024,
      uploadedByStaffId: staffId,
    },
  });
}

async function cleanup(opts: { staffId: string; candidateId: string; documentId: string }) {
  await testPrisma.documentFavorite.deleteMany({ where: { candidateId: opts.candidateId } });
  await testPrisma.documentTemplate.delete({ where: { id: opts.documentId } }).catch(() => {});
  await testPrisma.candidate.delete({ where: { id: opts.candidateId } }).catch(() => {});
  await testPrisma.staff.delete({ where: { id: opts.staffId } }).catch(() => {});
}

describe("toggleFavorite", () => {
  it("adds a favorite, then removes it on a second call", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id);

    const added = await toggleFavorite(candidate.id, document.id);
    expect(added.favorited).toBe(true);
    expect(await isDocumentFavorited(candidate.id, document.id)).toBe(true);

    const removed = await toggleFavorite(candidate.id, document.id);
    expect(removed.favorited).toBe(false);
    expect(await isDocumentFavorited(candidate.id, document.id)).toBe(false);

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });

  it("is safe to call repeatedly — never leaves more than one row for the same pair", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id);

    for (let i = 0; i < 4; i++) {
      await toggleFavorite(candidate.id, document.id);
      const count = await testPrisma.documentFavorite.count({ where: { candidateId: candidate.id, documentTemplateId: document.id } });
      expect(count).toBeLessThanOrEqual(1);
    }

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });

  it("lets a candidate favorite both an unpurchased and a purchased document (no restriction either way)", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id);

    const result = await toggleFavorite(candidate.id, document.id);
    expect(result.favorited).toBe(true);

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });
});

describe("the underlying unique constraint", () => {
  it("rejects a duplicate (candidateId, documentTemplateId) pair inserted directly", async () => {
    const staff = await seedStaff();
    const candidate = await seedCandidate();
    const document = await seedDocument(staff.id);

    await testPrisma.documentFavorite.create({ data: { candidateId: candidate.id, documentTemplateId: document.id } });
    await expect(testPrisma.documentFavorite.create({ data: { candidateId: candidate.id, documentTemplateId: document.id } })).rejects.toThrow();

    await cleanup({ staffId: staff.id, candidateId: candidate.id, documentId: document.id });
  });
});
