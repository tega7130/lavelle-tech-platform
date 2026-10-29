import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { testPrisma } from "./db";
import {
  startLawyerWebsite,
  updateLawyerWebsiteVerification,
  acknowledgeConductDisclaimer,
  updateLawyerWebsiteAbout,
  getLawyerWebsiteForCandidate,
  getConnectableCertificates,
  addLawyerQualification,
  updateLawyerQualification,
  deleteLawyerQualification,
  reorderLawyerQualifications,
  addLawyerExperience,
  deleteLawyerExperience,
  reorderLawyerExperiences,
  addLawyerPublication,
  updateLawyerPublication,
  deleteLawyerPublication,
  addLawyerActivity,
  deleteLawyerActivity,
  reorderLawyerActivities,
  updateLawyerWebsiteHandle,
  HandleNotOwnNameError,
  HandleTakenError,
  checkLawyerWebsitePublishable,
  requestPublishLawyerWebsite,
  PublishCheckError,
  approveLawyerWebsiteVerification,
  rejectLawyerWebsiteVerification,
  takeDownLawyerWebsite,
  takeDownLawyerWebsiteForSuspension,
  CONDUCT_DISCLAIMER_VERSION,
  updateLawyerWebsiteLookAndFeel,
  TemplateNotAvailableError,
} from "@/lib/lawyer-website";
import {
  LAWYER_WEBSITE_TEMPLATES,
  LAWYER_WEBSITE_COLOR_THEMES,
  LAWYER_WEBSITE_FONT_PAIRINGS,
  DEFAULT_TEMPLATE_KEY,
  DEFAULT_COLOR_THEME_KEY,
  DEFAULT_FONT_PAIRING_KEY,
} from "@/lib/lawyer-website-templates";
import { suspendCandidate } from "@/lib/candidate-status";
import { LawyerEntityType, LawyerWebsiteVerificationStatus, LawyerWebsiteSectionKey, LawyerQualificationSource } from "@/generated/prisma/client";

async function seedStaff() {
  return testPrisma.staff.create({
    data: { name: "Test LW Staff", email: `lw-staff-${crypto.randomUUID()}@example.com`, role: "CONTENT_MANAGER", passwordHash: "not-a-real-hash" },
  });
}

async function approveVerification(lawyerWebsiteId: string, staffId: string) {
  const verification = await testPrisma.lawyerWebsiteVerification.findUniqueOrThrow({ where: { lawyerWebsiteId } });
  return approveLawyerWebsiteVerification(verification.id, staffId);
}

async function seedProgrammeChain() {
  const staff = await testPrisma.staff.create({
    data: { name: "Test Lawyer-Site Staff", email: `lws-staff-${crypto.randomUUID()}@example.com`, role: "ACADEMIC_ADMIN", passwordHash: "not-a-real-hash" },
  });
  const category = await testPrisma.programmeCategory.create({
    data: { name: `LWS Category ${crypto.randomUUID()}`, slug: `lws-cat-${crypto.randomUUID()}` },
  });
  const programme = await testPrisma.programme.create({
    data: {
      code: `LWS-${crypto.randomUUID().slice(0, 8)}`,
      title: "Advanced Commercial Arbitration",
      categoryId: category.id,
      tier: "SPECIALIST",
      status: "ACTIVE",
      summary: "test",
      weeks: 12,
      weeklyHoursLabel: "6-8 hrs / week",
      feeMinor: 45_000_000,
      createdByStaffId: staff.id,
    },
  });
  const artwork = await testPrisma.mediaAsset.create({
    data: { kind: "image", storageKey: `test/lws-artwork-${crypto.randomUUID()}.png`, mimeType: "image/png", bytes: 100, originalFilename: "artwork.png", uploadedByStaffId: staff.id },
  });
  const template = await testPrisma.certificateTemplate.create({
    data: {
      name: `LWS template ${crypto.randomUUID().slice(0, 6)}`,
      artworkAssetId: artwork.id,
      appliesToTier: null,
      signatoryBlock: "Registrar",
      printedFields: { name: true },
      isActive: true,
      activatedAt: new Date(),
      createdByStaffId: staff.id,
    },
  });
  return { staffId: staff.id, categoryId: category.id, programmeId: programme.id, templateId: template.id, artworkAssetId: artwork.id };
}

async function seedCertificate(candidateId: string, chain: { programmeId: string; templateId: string }, overrides: { status?: "ACTIVE" | "REVOKED" } = {}) {
  return testPrisma.certificate.create({
    data: {
      certificateNumber: `LVL-TEST-${crypto.randomUUID().slice(0, 8)}`,
      candidateId,
      programmeId: chain.programmeId,
      pathway: "PATHWAY",
      holderName: "Test Holder",
      programmeTitle: "Advanced Commercial Arbitration",
      tier: "SPECIALIST",
      finalPercent: 82,
      band: "DISTINCTION",
      status: overrides.status ?? "ACTIVE",
      issuedAt: new Date("2025-06-01"),
      templateId: chain.templateId,
    },
  });
}

async function seedCandidate(overrides: { firstName?: string; lastName?: string; scnNumber?: string } = {}) {
  const candidate = await testPrisma.candidate.create({
    data: {
      applicantNumber: `LVL-APP-TEST-${crypto.randomUUID().slice(0, 8)}`,
      firstName: overrides.firstName ?? "Test",
      lastName: overrides.lastName ?? `Lawyer-${crypto.randomUUID().slice(0, 6)}`,
      email: `lawyer-site-test-${crypto.randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
      acceptedTermsAt: new Date(),
    },
  });
  if (overrides.scnNumber) {
    await testPrisma.candidateProfile.create({
      data: { candidateId: candidate.id, scnNumber: overrides.scnNumber },
    });
  }
  return candidate;
}

async function cleanup(...candidateIds: string[]) {
  await testPrisma.lawyerWebsite.deleteMany({ where: { candidateId: { in: candidateIds } } });
  await testPrisma.certificate.deleteMany({ where: { candidateId: { in: candidateIds } } });
  await testPrisma.candidateProfile.deleteMany({ where: { candidateId: { in: candidateIds } } });
  await testPrisma.candidate.deleteMany({ where: { id: { in: candidateIds } } });
}

async function cleanupProgrammeChain(chain: { staffId: string; categoryId: string; programmeId: string; templateId: string; artworkAssetId: string }) {
  await testPrisma.programme.deleteMany({ where: { id: chain.programmeId } });
  // CertificateTemplate references the artwork MediaAsset — removed first so the MediaAsset delete below has no referencing row left.
  await testPrisma.certificateTemplate.deleteMany({ where: { id: chain.templateId } });
  await testPrisma.mediaAsset.deleteMany({ where: { id: chain.artworkAssetId } });
  await testPrisma.programmeCategory.deleteMany({ where: { id: chain.categoryId } });
  await testPrisma.staff.deleteMany({ where: { id: chain.staffId } });
}

describe("startLawyerWebsite", () => {
  it("creates the site, seeds one section row per key in order, and a PENDING verification row", async () => {
    const candidate = await seedCandidate({ firstName: "Jane", lastName: "Okafor" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      expect(site.handle).toBe("jane-okafor");
      expect(site.entityType).toBe(LawyerEntityType.INDIVIDUAL);

      const sections = await testPrisma.lawyerWebsiteSection.findMany({
        where: { lawyerWebsiteId: site.id },
        orderBy: { orderIndex: "asc" },
      });
      expect(sections.map((s) => s.sectionKey)).toEqual([
        LawyerWebsiteSectionKey.ABOUT,
        LawyerWebsiteSectionKey.PRACTICE_AREAS,
        LawyerWebsiteSectionKey.QUALIFICATIONS,
        LawyerWebsiteSectionKey.EXPERIENCE,
        LawyerWebsiteSectionKey.PUBLICATIONS,
        LawyerWebsiteSectionKey.ACTIVITIES,
        LawyerWebsiteSectionKey.SOCIAL_CONTACT,
        LawyerWebsiteSectionKey.CV,
      ]);
      expect(sections.every((s) => s.isVisible)).toBe(true);

      const verification = await testPrisma.lawyerWebsiteVerification.findUniqueOrThrow({
        where: { lawyerWebsiteId: site.id },
      });
      expect(verification.status).toBe(LawyerWebsiteVerificationStatus.PENDING);
      expect(verification.scnNumber).toBeNull();
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("pre-fills scnNumber from the candidate's existing profile", async () => {
    const candidate = await seedCandidate({ firstName: "Chidi", lastName: "Eze", scnNumber: "SCN99887" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const verification = await testPrisma.lawyerWebsiteVerification.findUniqueOrThrow({
        where: { lawyerWebsiteId: site.id },
      });
      expect(verification.scnNumber).toBe("SCN99887");
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("builds the handle from the firm name for LAW_FIRM, not the candidate's own name", async () => {
    const candidate = await seedCandidate({ firstName: "Amaka", lastName: "Bello" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.LAW_FIRM, firmName: "Bello & Partners" });
      expect(site.handle).toBe("bello-and-partners");
      expect(site.firmName).toBe("Bello & Partners");
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("retries the handle with a numeric suffix on collision, rather than failing", async () => {
    const first = await seedCandidate({ firstName: "Tunde", lastName: "Adeyemi" });
    const second = await seedCandidate({ firstName: "Tunde", lastName: "Adeyemi" });
    try {
      const siteOne = await startLawyerWebsite(first.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const siteTwo = await startLawyerWebsite(second.id, { entityType: LawyerEntityType.INDIVIDUAL });
      expect(siteOne.handle).toBe("tunde-adeyemi");
      expect(siteTwo.handle).toBe("tunde-adeyemi-2");
    } finally {
      await cleanup(first.id, second.id);
    }
  });
});

describe("updateLawyerWebsiteVerification", () => {
  it("submits evidence, sets PENDING and submittedAt, and clears any prior rejection", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      // Simulate a prior admin rejection before resubmission.
      await testPrisma.lawyerWebsiteVerification.update({
        where: { lawyerWebsiteId: site.id },
        data: { status: LawyerWebsiteVerificationStatus.REJECTED, rejectionReason: "Blurry ID photo", reviewedAt: new Date() },
      });

      const updated = await updateLawyerWebsiteVerification(site.id, { scnNumber: "SCN55443" });
      expect(updated.status).toBe(LawyerWebsiteVerificationStatus.PENDING);
      expect(updated.rejectionReason).toBeNull();
      expect(updated.reviewedAt).toBeNull();
      expect(updated.scnNumber).toBe("SCN55443");
      expect(updated.submittedAt).not.toBeNull();
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("acknowledgeConductDisclaimer", () => {
  it("records the acknowledgement timestamp and the current disclaimer version", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const updated = await acknowledgeConductDisclaimer(site.id);
      expect(updated.conductDisclaimerAcknowledgedAt).not.toBeNull();
      expect(updated.conductDisclaimerVersion).toBe(CONDUCT_DISCLAIMER_VERSION);
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("updateLawyerWebsiteAbout", () => {
  it("updates each of the five independent About fields", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(site.id, {
        introText: "Commercial lawyer.",
        biographyText: "Full bio here.",
        personalStatementText: "What drew me in.",
        careerJourneyText: "My journey.",
        personalInterestsText: "Chess and reading.",
      });

      const reread = await getLawyerWebsiteForCandidate(candidate.id);
      expect(reread?.introText).toBe("Commercial lawyer.");
      expect(reread?.biographyText).toBe("Full bio here.");
      expect(reread?.personalStatementText).toBe("What drew me in.");
      expect(reread?.careerJourneyText).toBe("My journey.");
      expect(reread?.personalInterestsText).toBe("Chess and reading.");
    } finally {
      await cleanup(candidate.id);
    }
  });

  // The form always submits all five fields together (the component holds
  // every field in state), so this is a full replace, not a per-field
  // patch — same discipline as updateBlogPost. Leaving one blank clears
  // only that field because its sibling fields are resubmitted with their
  // real current values, not because the function merges partial input.
  it("is a full replace — an omitted field is cleared, not left as-is", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(site.id, { introText: "Commercial lawyer.", biographyText: "Full bio here." });
      await updateLawyerWebsiteAbout(site.id, { introText: "Commercial lawyer.", biographyText: "" });

      const reread = await getLawyerWebsiteForCandidate(candidate.id);
      expect(reread?.introText).toBe("Commercial lawyer.");
      expect(reread?.biographyText).toBeNull();
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("Qualifications — connecting a real Lavelle certificate", () => {
  it("getConnectableCertificates returns only this candidate's ACTIVE certificates, never a REVOKED one or another candidate's", async () => {
    const chain = await seedProgrammeChain();
    const owner = await seedCandidate();
    const stranger = await seedCandidate();
    try {
      const active = await seedCertificate(owner.id, chain);
      await seedCertificate(owner.id, chain, { status: "REVOKED" });
      await seedCertificate(stranger.id, chain);

      const connectable = await getConnectableCertificates(owner.id);
      expect(connectable.map((c) => c.id)).toEqual([active.id]);
    } finally {
      await cleanup(owner.id, stranger.id);
      await cleanupProgrammeChain(chain);
    }
  });

  it("connects a certificate as a verified qualification, snapshotting its title — and refuses a certificate that isn't this candidate's own ACTIVE one", async () => {
    const chain = await seedProgrammeChain();
    const owner = await seedCandidate();
    const stranger = await seedCandidate();
    try {
      const site = await startLawyerWebsite(owner.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const ownCert = await seedCertificate(owner.id, chain);
      const strangerCert = await seedCertificate(stranger.id, chain);
      const revokedCert = await seedCertificate(owner.id, chain, { status: "REVOKED" });

      const qualification = await addLawyerQualification(site.id, owner.id, {
        source: LawyerQualificationSource.LAVELLE_CERTIFICATE,
        certificateId: ownCert.id,
      });
      expect(qualification.title).toBe("Advanced Commercial Arbitration");
      expect(qualification.certificateId).toBe(ownCert.id);

      await expect(
        addLawyerQualification(site.id, owner.id, { source: LawyerQualificationSource.LAVELLE_CERTIFICATE, certificateId: strangerCert.id })
      ).rejects.toThrow();
      await expect(
        addLawyerQualification(site.id, owner.id, { source: LawyerQualificationSource.LAVELLE_CERTIFICATE, certificateId: revokedCert.id })
      ).rejects.toThrow();
    } finally {
      await cleanup(owner.id, stranger.id);
      await cleanupProgrammeChain(chain);
    }
  });

  it("refuses to edit a connected certificate's fields, but allows editing a manual entry", async () => {
    const chain = await seedProgrammeChain();
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const cert = await seedCertificate(candidate.id, chain);
      const connected = await addLawyerQualification(site.id, candidate.id, { source: LawyerQualificationSource.LAVELLE_CERTIFICATE, certificateId: cert.id });
      await expect(updateLawyerQualification(connected.id, site.id, { title: "Hacked title" })).rejects.toThrow();

      const manual = await addLawyerQualification(site.id, candidate.id, { source: LawyerQualificationSource.MANUAL, title: "LL.B" });
      const updated = await updateLawyerQualification(manual.id, site.id, { title: "LL.B (Hons)", issuer: "UNILAG", year: 2015 });
      expect(updated.title).toBe("LL.B (Hons)");
    } finally {
      await cleanup(candidate.id);
      await cleanupProgrammeChain(chain);
    }
  });

  it("delete and reorder are scoped to the owning site — can't reach another lawyer's qualification by id", async () => {
    const candidateA = await seedCandidate();
    const candidateB = await seedCandidate();
    try {
      const siteA = await startLawyerWebsite(candidateA.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const siteB = await startLawyerWebsite(candidateB.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const qualA = await addLawyerQualification(siteA.id, candidateA.id, { source: LawyerQualificationSource.MANUAL, title: "A's qualification" });

      // B's site can't delete or reorder A's row by guessing its id.
      await deleteLawyerQualification(qualA.id, siteB.id);
      await reorderLawyerQualifications(siteB.id, [qualA.id]);
      const stillThere = await testPrisma.lawyerQualification.findUnique({ where: { id: qualA.id } });
      expect(stillThere).not.toBeNull();

      await deleteLawyerQualification(qualA.id, siteA.id);
      expect(await testPrisma.lawyerQualification.findUnique({ where: { id: qualA.id } })).toBeNull();
    } finally {
      await cleanup(candidateA.id, candidateB.id);
    }
  });
});

describe("Experience", () => {
  it("adds, orders by creation, reorders, and deletes", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const first = await addLawyerExperience(site.id, { organisation: "Firm A", roleTitle: "Associate", startYear: 2018, endYear: 2021, isCurrent: false });
      const second = await addLawyerExperience(site.id, { organisation: "Firm B", roleTitle: "Senior Associate", startYear: 2021, isCurrent: true });
      expect(first.orderIndex).toBe(0);
      expect(second.orderIndex).toBe(1);
      expect(second.endYear).toBeNull(); // isCurrent forces endYear null regardless of input

      await reorderLawyerExperiences(site.id, [second.id, first.id]);
      const reread = await testPrisma.lawyerExperience.findMany({ where: { lawyerWebsiteId: site.id }, orderBy: { orderIndex: "asc" } });
      expect(reread.map((e) => e.id)).toEqual([second.id, first.id]);

      await deleteLawyerExperience(first.id, site.id);
      expect(await testPrisma.lawyerExperience.count({ where: { lawyerWebsiteId: site.id } })).toBe(1);
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("Publications", () => {
  it("creates an external link publication as-is, with no slug", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const pub = await addLawyerPublication(site.id, { kind: "EXTERNAL_LINK", title: "My Book", externalUrl: "https://example.com/my-book" });
      expect(pub.slug).toBeNull();
      expect(pub.externalUrl).toBe("https://example.com/my-book");
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("generates a unique slug for a native article, retrying with a numeric suffix on collision, and never regenerates it on edit", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const first = await addLawyerPublication(site.id, { kind: "NATIVE_ARTICLE", title: "Arbitration in Nigeria", body: "Body one." });
      const second = await addLawyerPublication(site.id, { kind: "NATIVE_ARTICLE", title: "Arbitration in Nigeria", body: "Body two." });
      expect(first.slug).toBe("arbitration-in-nigeria");
      expect(second.slug).toBe("arbitration-in-nigeria-2");

      const updated = await updateLawyerPublication(first.id, site.id, { title: "Arbitration in Nigeria (Revised)", body: "Updated body." });
      expect(updated.slug).toBe("arbitration-in-nigeria"); // unchanged by the title edit
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("publishing a native article sets publishedAt once, and unpublishing doesn't clear it", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const article = await addLawyerPublication(site.id, { kind: "NATIVE_ARTICLE", title: "My First Article" });
      expect(article.isPublished).toBe(false);
      expect(article.publishedAt).toBeNull();

      const published = await updateLawyerPublication(article.id, site.id, { title: article.title, isPublished: true });
      expect(published.isPublished).toBe(true);
      expect(published.publishedAt).not.toBeNull();
      const firstPublishedAt = published.publishedAt;

      const unpublished = await updateLawyerPublication(article.id, site.id, { title: article.title, isPublished: false });
      expect(unpublished.isPublished).toBe(false);
      expect(unpublished.publishedAt).toEqual(firstPublishedAt);
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("deletes scoped to the owning site", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const pub = await addLawyerPublication(site.id, { kind: "EXTERNAL_LINK", title: "X", externalUrl: "https://example.com" });
      await deleteLawyerPublication(pub.id, site.id);
      expect(await testPrisma.lawyerPublication.findUnique({ where: { id: pub.id } })).toBeNull();
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("Activities", () => {
  it("adds, reorders, and deletes", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const a = await addLawyerActivity(site.id, { title: "Member, NBA", year: 2019 });
      const b = await addLawyerActivity(site.id, { title: "Speaker, ABC Conference", year: 2023 });

      await reorderLawyerActivities(site.id, [b.id, a.id]);
      const reread = await testPrisma.lawyerActivity.findMany({ where: { lawyerWebsiteId: site.id }, orderBy: { orderIndex: "asc" } });
      expect(reread.map((x) => x.id)).toEqual([b.id, a.id]);

      await deleteLawyerActivity(a.id, site.id);
      expect(await testPrisma.lawyerActivity.count({ where: { lawyerWebsiteId: site.id } })).toBe(1);
    } finally {
      await cleanup(candidate.id);
    }
  });
});

describe("Same-name handle collisions", () => {
  it("flags handleAutoSuffixedAt when a same-name collision forces a numeric suffix, and leaves it null otherwise", async () => {
    const first = await seedCandidate({ firstName: "Tunde", lastName: "Adeyemi" });
    const second = await seedCandidate({ firstName: "Tunde", lastName: "Adeyemi" });
    try {
      const siteOne = await startLawyerWebsite(first.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const siteTwo = await startLawyerWebsite(second.id, { entityType: LawyerEntityType.INDIVIDUAL });
      expect(siteOne.handleAutoSuffixedAt).toBeNull();
      expect(siteTwo.handle).toBe("tunde-adeyemi-2");
      expect(siteTwo.handleAutoSuffixedAt).not.toBeNull();
    } finally {
      await cleanup(first.id, second.id);
    }
  });

  it("updateLawyerWebsiteHandle accepts a custom address that still contains the candidate's own name, and clears the collision flag", async () => {
    const first = await seedCandidate({ firstName: "Tunde", lastName: "Adeyemi" });
    const second = await seedCandidate({ firstName: "Tunde", lastName: "Adeyemi" });
    try {
      await startLawyerWebsite(first.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const siteTwo = await startLawyerWebsite(second.id, { entityType: LawyerEntityType.INDIVIDUAL });
      expect(siteTwo.handleAutoSuffixedAt).not.toBeNull();

      const updated = await updateLawyerWebsiteHandle(siteTwo.id, second.id, "Tunde K. Adeyemi");
      expect(updated.handle).toBe("tunde-k-adeyemi");
      expect(updated.handleAutoSuffixedAt).toBeNull();
    } finally {
      await cleanup(first.id, second.id);
    }
  });

  it("refuses an address that doesn't represent the candidate's own name", async () => {
    const candidate = await seedCandidate({ firstName: "Tunde", lastName: "Adeyemi" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await expect(updateLawyerWebsiteHandle(site.id, candidate.id, "best-lawyer-in-lagos")).rejects.toThrow(HandleNotOwnNameError);
      // Missing the surname entirely is refused too, not just a wholly unrelated string.
      await expect(updateLawyerWebsiteHandle(site.id, candidate.id, "tunde")).rejects.toThrow(HandleNotOwnNameError);
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("refuses a reserved word even when it happens to represent the candidate's own name", async () => {
    // Slugifies to exactly "programme-notifications" — a real reserved route — while still genuinely satisfying the own-name check.
    const candidate = await seedCandidate({ firstName: "Programme", lastName: "Notifications" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await expect(updateLawyerWebsiteHandle(site.id, candidate.id, "Programme Notifications")).rejects.toThrow(HandleTakenError);
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("refuses an address already taken by another lawyer, even one that represents the requester's own name", async () => {
    const first = await seedCandidate({ firstName: "Chidi", lastName: "Okoro" });
    const second = await seedCandidate({ firstName: "Chidi", lastName: "Okoro" });
    try {
      const siteOne = await startLawyerWebsite(first.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const siteTwo = await startLawyerWebsite(second.id, { entityType: LawyerEntityType.INDIVIDUAL });
      // Both named "Chidi Okoro" — site two try to steal site one's exact handle.
      await expect(updateLawyerWebsiteHandle(siteTwo.id, second.id, siteOne.handle)).rejects.toThrow(HandleTakenError);
    } finally {
      await cleanup(first.id, second.id);
    }
  });

  it("works for a law firm — the custom address must contain the firm's name instead of the candidate's own", async () => {
    const candidate = await seedCandidate({ firstName: "Amaka", lastName: "Bello" });
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.LAW_FIRM, firmName: "Bello & Partners" });
      const updated = await updateLawyerWebsiteHandle(site.id, candidate.id, "Bello and Partners Legal");
      expect(updated.handle).toBe("bello-and-partners-legal");
      await expect(updateLawyerWebsiteHandle(site.id, candidate.id, "amaka-bello")).rejects.toThrow(HandleNotOwnNameError);
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("is scoped to the owning candidate — can't update another lawyer's handle by guessing the site id", async () => {
    const owner = await seedCandidate({ firstName: "Chidi", lastName: "Eze" });
    const stranger = await seedCandidate({ firstName: "Someone", lastName: "Else" });
    try {
      const site = await startLawyerWebsite(owner.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await expect(updateLawyerWebsiteHandle(site.id, stranger.id, "chidi-eze-ii")).rejects.toThrow();
    } finally {
      await cleanup(owner.id, stranger.id);
    }
  });
});

describe("checkLawyerWebsitePublishable", () => {
  it("fails for an empty shell, fails without the current disclaimer version, fails without approved verification — and passes once all three hold", async () => {
    const candidate = await seedCandidate();
    const staff = await seedStaff();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      let failures = await checkLawyerWebsitePublishable(testPrisma, site.id);
      expect(failures.length).toBeGreaterThanOrEqual(3);

      await updateLawyerWebsiteAbout(site.id, { introText: "Something." });
      await acknowledgeConductDisclaimer(site.id);
      failures = await checkLawyerWebsitePublishable(testPrisma, site.id);
      expect(failures).toEqual([{ reason: "Your identity verification must be approved before you can publish." }]);

      await approveVerification(site.id, staff.id);
      failures = await checkLawyerWebsitePublishable(testPrisma, site.id);
      expect(failures).toEqual([]);
    } finally {
      await cleanup(candidate.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });
});

describe("requestPublishLawyerWebsite", () => {
  it("queues the request (publishRequestedAt) and throws a clear message when verification is still PENDING, without publishing", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(site.id, { introText: "Something." });

      await expect(requestPublishLawyerWebsite(site.id)).rejects.toThrow(PublishCheckError);

      const reread = await testPrisma.lawyerWebsite.findUniqueOrThrow({ where: { id: site.id } });
      expect(reread.isPublished).toBe(false);
      expect(reread.publishRequestedAt).not.toBeNull();
      // The disclaimer is still re-confirmed even though publish itself didn't complete.
      expect(reread.conductDisclaimerAcknowledgedAt).not.toBeNull();
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("fails clearly, naming the rejection reason, when verification was REJECTED — and never queues a publish request for it", async () => {
    const candidate = await seedCandidate();
    const staff = await seedStaff();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const verification = await testPrisma.lawyerWebsiteVerification.findUniqueOrThrow({ where: { lawyerWebsiteId: site.id } });
      await rejectLawyerWebsiteVerification(verification.id, staff.id, "ID photo was unreadable");

      await expect(requestPublishLawyerWebsite(site.id)).rejects.toThrow(/ID photo was unreadable/);
      const reread = await testPrisma.lawyerWebsite.findUniqueOrThrow({ where: { id: site.id } });
      expect(reread.publishRequestedAt).toBeNull();
    } finally {
      await cleanup(candidate.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });

  it("publishes immediately when verification is already APPROVED and the content gate passes", async () => {
    const candidate = await seedCandidate();
    const staff = await seedStaff();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(site.id, { introText: "Something." });
      await approveVerification(site.id, staff.id);

      const published = await requestPublishLawyerWebsite(site.id);
      expect(published.isPublished).toBe(true);
      expect(published.publishedAt).not.toBeNull();
    } finally {
      await cleanup(candidate.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });
});

describe("approveLawyerWebsiteVerification", () => {
  it("auto-publishes a site that was already waiting (publishRequestedAt set) once approved and the content gate passes", async () => {
    const candidate = await seedCandidate();
    const staff = await seedStaff();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(site.id, { introText: "Something." });
      await expect(requestPublishLawyerWebsite(site.id)).rejects.toThrow(); // queues it — still PENDING

      await approveVerification(site.id, staff.id);

      const reread = await testPrisma.lawyerWebsite.findUniqueOrThrow({ where: { id: site.id } });
      expect(reread.isPublished).toBe(true);
      expect(reread.publishRequestedAt).toBeNull();
    } finally {
      await cleanup(candidate.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });

  it("does NOT auto-publish on approval alone if the content gate still fails — approving identity isn't approving content", async () => {
    const candidate = await seedCandidate();
    const staff = await seedStaff();
    try {
      // Never added any content, and never even clicked Publish — publishRequestedAt is null.
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await approveVerification(site.id, staff.id);

      const reread = await testPrisma.lawyerWebsite.findUniqueOrThrow({ where: { id: site.id } });
      expect(reread.isPublished).toBe(false);
    } finally {
      await cleanup(candidate.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });
});

describe("rejectLawyerWebsiteVerification", () => {
  it("records the mandatory reason and clears any pending publish request", async () => {
    const candidate = await seedCandidate();
    const staff = await seedStaff();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(site.id, { introText: "Something." });
      await expect(requestPublishLawyerWebsite(site.id)).rejects.toThrow(); // now waiting

      const verification = await testPrisma.lawyerWebsiteVerification.findUniqueOrThrow({ where: { lawyerWebsiteId: site.id } });
      await rejectLawyerWebsiteVerification(verification.id, staff.id, "ID photo was unreadable");

      const rereadVerification = await testPrisma.lawyerWebsiteVerification.findUniqueOrThrow({ where: { id: verification.id } });
      expect(rereadVerification.status).toBe(LawyerWebsiteVerificationStatus.REJECTED);
      expect(rereadVerification.rejectionReason).toBe("ID photo was unreadable");

      const reread = await testPrisma.lawyerWebsite.findUniqueOrThrow({ where: { id: site.id } });
      expect(reread.publishRequestedAt).toBeNull();
    } finally {
      await cleanup(candidate.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });
});

describe("Takedown", () => {
  it("takeDownLawyerWebsite unpublishes a live site and records who did it and why", async () => {
    const candidate = await seedCandidate();
    const staff = await seedStaff();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(site.id, { introText: "Something." });
      await approveVerification(site.id, staff.id);
      await requestPublishLawyerWebsite(site.id);

      const takenDown = await takeDownLawyerWebsite(site.id, staff.id, "Contains a client's name");
      expect(takenDown.isPublished).toBe(false);
      expect(takenDown.takenDownByStaffId).toBe(staff.id);
      expect(takenDown.takenDownReason).toBe("Contains a client's name");
    } finally {
      await cleanup(candidate.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });

  it("takeDownLawyerWebsiteForSuspension is a no-op when there's no site, or the site was never published, but takes down a published one with no staff attributed", async () => {
    const neverBuilt = await seedCandidate();
    const neverPublished = await seedCandidate();
    const published = await seedCandidate();
    const staff = await seedStaff();
    try {
      await takeDownLawyerWebsiteForSuspension(neverBuilt.id); // no site at all — must not throw

      const draftSite = await startLawyerWebsite(neverPublished.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await takeDownLawyerWebsiteForSuspension(neverPublished.id);
      expect((await testPrisma.lawyerWebsite.findUniqueOrThrow({ where: { id: draftSite.id } })).takenDownAt).toBeNull();

      const liveSite = await startLawyerWebsite(published.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(liveSite.id, { introText: "Something." });
      await approveVerification(liveSite.id, staff.id);
      await requestPublishLawyerWebsite(liveSite.id);

      await takeDownLawyerWebsiteForSuspension(published.id);
      const reread = await testPrisma.lawyerWebsite.findUniqueOrThrow({ where: { id: liveSite.id } });
      expect(reread.isPublished).toBe(false);
      expect(reread.takenDownByStaffId).toBeNull(); // cascade, not a deliberate admin action
      expect(reread.takenDownReason).toBe("Candidate account suspended");
    } finally {
      await cleanup(neverBuilt.id, neverPublished.id, published.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });

  it("suspendCandidate itself cascades to take down a published lawyer website", async () => {
    const candidate = await seedCandidate();
    const staff = await seedStaff();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await updateLawyerWebsiteAbout(site.id, { introText: "Something." });
      await approveVerification(site.id, staff.id);
      await requestPublishLawyerWebsite(site.id);

      await suspendCandidate(candidate.id, staff.id, "Misconduct during an examination");

      const reread = await testPrisma.lawyerWebsite.findUniqueOrThrow({ where: { id: site.id } });
      expect(reread.isPublished).toBe(false);
      expect(reread.takenDownReason).toBe("Candidate account suspended");
    } finally {
      await cleanup(candidate.id);
      await testPrisma.staff.deleteMany({ where: { id: staff.id } });
    }
  });
});

describe("Look & feel (Phase 5)", () => {
  it("startLawyerWebsite sets sensible defaults so a new site is never unstyled", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      expect(site.templateKey).toBe(DEFAULT_TEMPLATE_KEY);
      expect(site.colorThemeKey).toBe(DEFAULT_COLOR_THEME_KEY);
      expect(site.fontPairingKey).toBe(DEFAULT_FONT_PAIRING_KEY);
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("accepts any valid combination of registry keys", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      const template = LAWYER_WEBSITE_TEMPLATES.find((t) => t.key !== DEFAULT_TEMPLATE_KEY)!;
      const colorTheme = LAWYER_WEBSITE_COLOR_THEMES.find((c) => c.key !== DEFAULT_COLOR_THEME_KEY)!;
      const fontPairing = LAWYER_WEBSITE_FONT_PAIRINGS.find((f) => f.key !== DEFAULT_FONT_PAIRING_KEY)!;

      const updated = await updateLawyerWebsiteLookAndFeel(site.id, {
        templateKey: template.key,
        colorThemeKey: colorTheme.key,
        fontPairingKey: fontPairing.key,
      });
      expect(updated.templateKey).toBe(template.key);
      expect(updated.colorThemeKey).toBe(colorTheme.key);
      expect(updated.fontPairingKey).toBe(fontPairing.key);
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("refuses an unknown template, color theme, or font pairing key", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      await expect(
        updateLawyerWebsiteLookAndFeel(site.id, { templateKey: "not-a-real-template", colorThemeKey: DEFAULT_COLOR_THEME_KEY, fontPairingKey: DEFAULT_FONT_PAIRING_KEY })
      ).rejects.toThrow("Unknown template.");
      await expect(
        updateLawyerWebsiteLookAndFeel(site.id, { templateKey: DEFAULT_TEMPLATE_KEY, colorThemeKey: "not-a-real-theme", fontPairingKey: DEFAULT_FONT_PAIRING_KEY })
      ).rejects.toThrow("Unknown color theme.");
      await expect(
        updateLawyerWebsiteLookAndFeel(site.id, { templateKey: DEFAULT_TEMPLATE_KEY, colorThemeKey: DEFAULT_COLOR_THEME_KEY, fontPairingKey: "not-a-real-pairing" })
      ).rejects.toThrow("Unknown font pairing.");
    } finally {
      await cleanup(candidate.id);
    }
  });

  it("refuses a PAID template — scaffolding for Phase 6, unreachable today since every template is FREE", async () => {
    const candidate = await seedCandidate();
    try {
      const site = await startLawyerWebsite(candidate.id, { entityType: LawyerEntityType.INDIVIDUAL });
      // Every real template is FREE right now, so this exercises the guard directly rather than relying on one existing.
      const originalTier = LAWYER_WEBSITE_TEMPLATES[0].tier;
      LAWYER_WEBSITE_TEMPLATES[0].tier = "PAID";
      try {
        await expect(
          updateLawyerWebsiteLookAndFeel(site.id, {
            templateKey: LAWYER_WEBSITE_TEMPLATES[0].key,
            colorThemeKey: DEFAULT_COLOR_THEME_KEY,
            fontPairingKey: DEFAULT_FONT_PAIRING_KEY,
          })
        ).rejects.toThrow(TemplateNotAvailableError);
      } finally {
        LAWYER_WEBSITE_TEMPLATES[0].tier = originalTier;
      }
    } finally {
      await cleanup(candidate.id);
    }
  });
});
