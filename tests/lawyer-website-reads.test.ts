import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import { startLawyerWebsite, addLawyerPublication } from "@/lib/lawyer-website";
import { getPublishedLawyerWebsiteByHandle, getLawyerWebsitePreview, getPublishedLawyerArticle, RESERVED_LAWYER_HANDLES } from "@/lib/lawyer-website-reads";
import { LawyerEntityType } from "@/generated/prisma/client";

async function seedCandidate(overrides: { firstName?: string; lastName?: string } = {}) {
  return testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      firstName: overrides.firstName ?? "Test",
      lastName: overrides.lastName ?? `Reads-${crypto.randomUUID().slice(0, 6)}`,
      email: `lawyer-site-reads-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
}

async function cleanup(...candidateIds: string[]) {
  await testPrisma.lawyerWebsite.deleteMany({ where: { candidateId: { in: candidateIds } } });
  await testPrisma.candidate.deleteMany({ where: { id: { in: candidateIds } } });
}

describe("Reserved handles", () => {
  it("startLawyerWebsite never assigns a handle that collides with an existing top-level route", async () => {
    // "Blog" slugifies to the reserved word "blog" exactly.
    const candidate = await seedCandidate({ firstName: "Blog", lastName: "" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      expect(RESERVED_LAWYER_HANDLES.has(site.handle)).toBe(false);
      expect(site.handle).toBe("blog-2");
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("getPublishedLawyerWebsiteByHandle", () => {
  it("returns null for a site that exists but isn't published", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      expect(await getPublishedLawyerWebsiteByHandle(site.handle)).toBeNull();
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("returns null for a handle that doesn't exist at all", async () => {
    expect(await getPublishedLawyerWebsiteByHandle(`nonexistent-${crypto.randomUUID()}`)).toBeNull();
  });

  it("once published, filters out a draft native article but keeps a published one and every external link", async () => {
    const candidate = await seedCandidate({ firstName: "Jane", lastName: "Okafor" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const draft = await addLawyerPublication(site.id, { kind: "NATIVE_ARTICLE", title: "Still Drafting", body: "wip" });
      const published = await addLawyerPublication(site.id, { kind: "NATIVE_ARTICLE", title: "Finished Piece", body: "done" });
      await testPrisma.lawyerPublication.update({ where: { id: published.id }, data: { isPublished: true, publishedAt: new Date() } });
      await addLawyerPublication(site.id, { kind: "EXTERNAL_LINK", title: "My Book", externalUrl: "https://example.com/book" });

      // Nothing can flip isPublished yet (Phase 4) — write it directly to simulate the post-Phase-4 state this read must handle correctly.
      await testPrisma.lawyerWebsite.update({ where: { id: site.id }, data: { isPublished: true, publishedAt: new Date() } });

      const view = await getPublishedLawyerWebsiteByHandle(site.handle);
      expect(view).not.toBeNull();
      expect(view!.displayName).toBe("Jane Okafor");
      const titles = view!.publications.map((p) => p.title);
      expect(titles).toContain("Finished Piece");
      expect(titles).toContain("My Book");
      expect(titles).not.toContain("Still Drafting");
      void draft;
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("a law firm site displays the firm name, not the candidate's own name", async () => {
    const candidate = await seedCandidate({ firstName: "Amaka", lastName: "Bello" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.LAW_FIRM, firmName: "Bello & Partners" });
      await testPrisma.lawyerWebsite.update({ where: { id: site.id }, data: { isPublished: true, publishedAt: new Date() } });
      const view = await getPublishedLawyerWebsiteByHandle(site.handle);
      expect(view!.displayName).toBe("Bello & Partners");
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("getLawyerWebsitePreview", () => {
  it("shapes the owner's draft exactly like the public view would, filtering drafts the same way, regardless of the site's own publish status", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await addLawyerPublication(site.id, { kind: "NATIVE_ARTICLE", title: "Draft Article", body: "wip" });
      // Site is NOT published — preview must still work (unlike the public read, which would return null).
      const preview = await getLawyerWebsitePreview(candidate.id);
      expect(preview).not.toBeNull();
      expect(preview!.publications.map((p) => p.title)).not.toContain("Draft Article");
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("returns null when the candidate hasn't started a site yet", async () => {
    const candidate = await seedCandidate();
    try {
      expect(await getLawyerWebsitePreview(candidate.id)).toBeNull();
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("getPublishedLawyerArticle", () => {
  it("requires both the article and its parent site to be published", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const article = await addLawyerPublication(site.id, { kind: "NATIVE_ARTICLE", title: "My Article", body: "content" });

      // Neither published yet.
      expect(await getPublishedLawyerArticle(site.handle, article.slug!)).toBeNull();

      // Article published, but site still isn't.
      await testPrisma.lawyerPublication.update({ where: { id: article.id }, data: { isPublished: true, publishedAt: new Date() } });
      expect(await getPublishedLawyerArticle(site.handle, article.slug!)).toBeNull();

      // Both published.
      await testPrisma.lawyerWebsite.update({ where: { id: site.id }, data: { isPublished: true, publishedAt: new Date() } });
      const result = await getPublishedLawyerArticle(site.handle, article.slug!);
      expect(result?.title).toBe("My Article");
    } finally {
      await cleanup(candidate.id);
    }
  });
});
