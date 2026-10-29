import "server-only";
import { prisma } from "@/lib/prisma";
import { getSignedAssetUrl } from "@/lib/storage";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Current top-level route segments this app actually has, plus a small
 * set of paths that must always resolve to something other than a
 * lawyer's site (Next.js serves these from elsewhere regardless, but a
 * reserved handle is never even offered in the first place, which is
 * the cheaper failure mode). A root-level [handle] route always loses
 * to a real static route at the same path (Next.js's own precedence),
 * so this list only matters for ROUTES ADDED LATER — add any new
 * top-level route here too, or it could silently shadow an existing
 * lawyer's page at that exact handle.
 */
export const RESERVED_LAWYER_HANDLES = new Set([
  "admin",
  "api",
  "actions",
  "blog",
  "checkout",
  "contact",
  "forgot-password",
  "learn",
  "library",
  "pay",
  "portal",
  "preview",
  "privacy",
  "programme-notifications",
  "programmes",
  "register",
  "sentry-example-page",
  "sign-in",
  "sitting",
  "staff",
  "terms",
  "verify",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
]);

const siteWithViewRelations = {
  candidate: { select: { firstName: true, lastName: true } },
  cvAsset: { select: { storageKey: true } },
  sections: { orderBy: { orderIndex: "asc" } },
  qualifications: { orderBy: { orderIndex: "asc" } },
  experiences: { orderBy: { orderIndex: "asc" } },
  publications: { orderBy: { orderIndex: "asc" } },
  activities: { orderBy: { orderIndex: "asc" } },
} satisfies Prisma.LawyerWebsiteInclude;

type SiteWithViewRelations = Prisma.LawyerWebsiteGetPayload<{ include: typeof siteWithViewRelations }>;

async function safeDownloadUrl(storageKey: string | null | undefined): Promise<string | null> {
  if (!storageKey) return null;
  try {
    return await getSignedAssetUrl(storageKey, 300, true);
  } catch (error) {
    // A broken CV link degrades to "no download" for that one site, same
    // discipline as blog-reads.ts's safeHeroImageUrl — never a 500 for
    // every visitor over one bad asset.
    console.error(`Failed to build a download URL for asset ${storageKey}:`, error);
    return null;
  }
}

/**
 * The one place a raw site (with its relations) becomes LawyerSiteView's
 * props — used by BOTH the real public page and the owner's private
 * preview, so there is exactly one filtering rule to keep correct, not
 * two hand-kept-in-sync copies. A draft native article is filtered out
 * here unconditionally: the preview's whole point is showing what WOULD
 * be public if published right now, so it must apply the identical rule
 * the real public page applies, never a looser one.
 */
export async function shapeLawyerWebsiteForView(site: SiteWithViewRelations) {
  return {
    handle: site.handle,
    displayName: site.entityType === "LAW_FIRM" ? (site.firmName ?? "") : `${site.candidate.firstName} ${site.candidate.lastName}`,
    templateKey: site.templateKey,
    colorThemeKey: site.colorThemeKey,
    fontPairingKey: site.fontPairingKey,
    introText: site.introText,
    biographyText: site.biographyText,
    personalStatementText: site.personalStatementText,
    careerJourneyText: site.careerJourneyText,
    personalInterestsText: site.personalInterestsText,
    practiceAreas: (site.practiceAreas as string[] | null) ?? [],
    socialLinks: (site.socialLinks as { platform: string; url: string }[] | null) ?? [],
    sections: site.sections.map((s) => ({ sectionKey: s.sectionKey, isVisible: s.isVisible })),
    qualifications: site.qualifications.map((q) => ({ id: q.id, source: q.source, title: q.title, issuer: q.issuer, year: q.year })),
    experiences: site.experiences.map((e) => ({
      id: e.id,
      organisation: e.organisation,
      roleTitle: e.roleTitle,
      startYear: e.startYear,
      endYear: e.endYear,
      isCurrent: e.isCurrent,
      description: e.description,
    })),
    publications: site.publications
      .filter((p) => p.kind === "EXTERNAL_LINK" || p.isPublished)
      .map((p) => ({ id: p.id, kind: p.kind, title: p.title, externalUrl: p.externalUrl, excerpt: p.excerpt, slug: p.slug, isPublished: p.isPublished })),
    activities: site.activities.map((a) => ({ id: a.id, title: a.title, description: a.description, year: a.year })),
    cvDownloadUrl: await safeDownloadUrl(site.cvAsset?.storageKey),
  };
}

/**
 * Public lookup — returns null for an unpublished, nonexistent, or
 * taken-down site (all three collapse to the same "not found" outcome a
 * visitor sees), same not-published-returns-null rule as
 * getPublishedBlogPost.
 */
export async function getPublishedLawyerWebsiteByHandle(handle: string) {
  const site = await prisma.lawyerWebsite.findUnique({ where: { handle }, include: siteWithViewRelations });
  if (!site || !site.isPublished) return null;
  return shapeLawyerWebsiteForView(site);
}

/** The signed-in owner's own draft, shaped exactly like the public view would render it once published — used only by the authenticated preview route, never exposed publicly. */
export async function getLawyerWebsitePreview(candidateId: string) {
  const site = await prisma.lawyerWebsite.findUnique({ where: { candidateId }, include: siteWithViewRelations });
  if (!site) return null;
  return shapeLawyerWebsiteForView(site);
}

/** An admin reviewer's view of one candidate's draft — same shape and filtering as the real public page would apply, by id rather than by handle/publish-status (staff permission is the caller's job, not this function's). */
export async function getLawyerWebsiteForAdminReview(lawyerWebsiteId: string) {
  const site = await prisma.lawyerWebsite.findUnique({ where: { id: lawyerWebsiteId }, include: siteWithViewRelations });
  if (!site) return null;
  return shapeLawyerWebsiteForView(site);
}

/**
 * The verification review queue — PENDING requests only, oldest first
 * (ordinary queue fairness), with the evidence resolved to short-lived
 * signed URLs so a reviewer can actually open them. "Ready and waiting"
 * (publishRequestedAt set) is surfaced as a flag rather than a separate
 * sort, so the admin UI can badge it without relying on Prisma's
 * cross-relation null-ordering, which varies by version.
 */
export async function listLawyerWebsiteVerificationQueue() {
  const rows = await prisma.lawyerWebsiteVerification.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: {
      lawyerWebsite: { include: { candidate: { select: { firstName: true, lastName: true, email: true } } } },
      idCardEvidenceAsset: { select: { storageKey: true } },
      firmEvidenceAsset: { select: { storageKey: true } },
    },
  });

  return Promise.all(
    rows.map(async (v) => ({
      verificationId: v.id,
      lawyerWebsiteId: v.lawyerWebsiteId,
      candidateName: `${v.lawyerWebsite.candidate.firstName} ${v.lawyerWebsite.candidate.lastName}`,
      candidateEmail: v.lawyerWebsite.candidate.email,
      entityType: v.lawyerWebsite.entityType,
      firmName: v.lawyerWebsite.firmName,
      handle: v.lawyerWebsite.handle,
      scnNumber: v.scnNumber,
      cacNumber: v.cacNumber,
      idCardEvidenceUrl: await safeDownloadUrl(v.idCardEvidenceAsset?.storageKey),
      firmEvidenceUrl: await safeDownloadUrl(v.firmEvidenceAsset?.storageKey),
      submittedAt: v.submittedAt,
      isWaitingToPublish: !!v.lawyerWebsite.publishRequestedAt,
    }))
  );
}

/** For the Approved/Rejected history tabs — same admin screen, not the live queue. */
export async function listLawyerWebsiteVerificationHistory(status: "APPROVED" | "REJECTED") {
  const rows = await prisma.lawyerWebsiteVerification.findMany({
    where: { status },
    orderBy: { reviewedAt: "desc" },
    include: { lawyerWebsite: { include: { candidate: { select: { firstName: true, lastName: true, email: true } } } } },
  });
  return rows.map((v) => ({
    verificationId: v.id,
    candidateName: `${v.lawyerWebsite.candidate.firstName} ${v.lawyerWebsite.candidate.lastName}`,
    candidateEmail: v.lawyerWebsite.candidate.email,
    handle: v.lawyerWebsite.handle,
    reviewedAt: v.reviewedAt,
    rejectionReason: v.rejectionReason,
  }));
}

/** A native article's own page — returns null unless both the article and its parent site are published. */
export async function getPublishedLawyerArticle(handle: string, slug: string) {
  const publication = await prisma.lawyerPublication.findFirst({
    where: { slug, kind: "NATIVE_ARTICLE", isPublished: true, lawyerWebsite: { handle, isPublished: true } },
    include: { lawyerWebsite: { include: { candidate: { select: { firstName: true, lastName: true } } } } },
  });
  if (!publication) return null;

  const site = publication.lawyerWebsite;
  return {
    title: publication.title,
    excerpt: publication.excerpt,
    body: publication.body ?? "",
    publishedAt: publication.publishedAt,
    handle: site.handle,
    authorDisplayName: site.entityType === "LAW_FIRM" ? (site.firmName ?? "") : `${site.candidate.firstName} ${site.candidate.lastName}`,
    templateKey: site.templateKey,
    colorThemeKey: site.colorThemeKey,
    fontPairingKey: site.fontPairingKey,
  };
}

/** Every published site's handle — for static-params-style enumeration if ever needed; not used for ISR here (see [handle]/page.tsx's own comment on why plain SSR fits better). */
export async function listPublishedLawyerWebsiteHandles() {
  const sites = await prisma.lawyerWebsite.findMany({ where: { isPublished: true }, select: { handle: true } });
  return sites.map((s) => s.handle);
}
