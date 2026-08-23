import "server-only";
import { prisma } from "@/lib/prisma";
import { formatNaira, tierLabel, youtubeEmbedUrl } from "@/lib/format";
import { getSignedAssetUrl } from "@/lib/storage";

/**
 * Defaults are computed here, on every read, never copied at publish
 * time (rule 2) — a fee change on Programme reaches the site on the
 * next render with no republish. useDefaults=false listings render the
 * override fields instead; publishListing guarantees those are filled
 * before a listing can go live with useDefaults off.
 */
function effectiveContent(listing: {
  useDefaults: boolean;
  headline: string | null;
  summary: string | null;
  outcomes: unknown;
  includes: unknown;
  assessmentNote: string | null;
  paymentNote: string | null;
}, programme: { title: string; summary: string }) {
  const outcomes = (listing.outcomes as string[] | null) ?? [];
  const includes = (listing.includes as string[] | null) ?? [];
  return {
    headline: listing.useDefaults ? programme.title : listing.headline!,
    summary: listing.useDefaults ? programme.summary : listing.summary!,
    outcomes,
    includes,
    paymentNote: listing.paymentNote ?? "Paid once, for this programme only. Card, transfer or USSD.",
  };
}

/** The specializations grid + contact dropdown source — published only, ordered. */
export async function getPublishedListings() {
  const rows = await prisma.programmeListing.findMany({
    where: { isPublished: true },
    orderBy: { orderIndex: "asc" },
    include: {
      programme: { select: { code: true, title: true, summary: true, tier: true, weeks: true, feeMinor: true } },
    },
  });
  return rows.map((r) => {
    const content = effectiveContent(r, r.programme);
    return {
      code: r.programme.code,
      title: content.headline,
      blurb: content.summary,
      tier: r.programme.tier,
      tierLabel: tierLabel(r.programme.tier),
      weeks: `${r.programme.weeks} weeks`,
      fee: formatNaira(r.programme.feeMinor),
    };
  });
}

/**
 * Resolves the listing's preview video, one level of either/or on top of
 * Programme.coverVideoUrl/coverVideoAsset's own either/or: useCoverVideo
 * reuses that clip (resolved here, never copied — a re-recorded cover
 * video reaches the site with no republish), or the listing's own
 * videoUrl/videoAsset overrides it for the public page specifically.
 * A hosted URL always wins the embed check first — an uploaded file is
 * only used as a direct <video> src when there's no recognizable
 * YouTube link.
 */
function effectiveVideo(
  listing: {
    useCoverVideo: boolean;
    videoUrl: string | null;
    videoAsset: { storageKey: string } | null;
  },
  programme: {
    coverVideoUrl: string | null;
    coverVideoAsset: { storageKey: string } | null;
  }
) {
  const url = listing.useCoverVideo ? programme.coverVideoUrl : listing.videoUrl;
  const asset = listing.useCoverVideo ? programme.coverVideoAsset : listing.videoAsset;
  if (!url && !asset) return null;

  const embedUrl = url ? youtubeEmbedUrl(url) : null;
  const directVideoUrl = asset ? getSignedAssetUrl(asset.storageKey) : !embedUrl ? url : null;
  if (!embedUrl && !directVideoUrl) return null;
  return { embedUrl, directVideoUrl };
}

/**
 * The standalone programme page. Titles and structure only — no slide
 * bodies (rule 4: this is the paid product) — plus an optional preview
 * video, a deliberate exception: short and explanatory, not the course
 * itself. The syllabus always comes from the live Module/Lecture rows,
 * never an override (rule 3): an out-of-date public syllabus is worse
 * than none.
 */
export async function getListingDetail(code: string) {
  const programme = await prisma.programme.findUnique({
    where: { code },
    include: {
      listing: { include: { videoAsset: { select: { storageKey: true } } } },
      coverVideoAsset: { select: { storageKey: true } },
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lectures: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true } },
        },
      },
      assessmentWeightings: true,
    },
  });
  if (!programme || !programme.listing || !programme.listing.isPublished) return null;

  const content = effectiveContent(programme.listing, programme);
  const video = effectiveVideo(programme.listing, programme);
  const totalLectures = programme.modules.reduce((sum, m) => sum + m.lectures.length, 0);

  const ASSESSMENT_LABEL: Record<string, string> = { QUIZ: "Module quizzes", DRAFTING: "Drafting exercises", EXAMINATION: "Certifying examination" };
  const ASSESSMENT_DETAIL: Record<string, string> = {
    QUIZ: "Marked automatically",
    DRAFTING: "Marked by faculty with written feedback",
    EXAMINATION: "Proctored, objective and written questions",
  };

  return {
    code: programme.code,
    tier: programme.tier,
    tierLabel: tierLabel(programme.tier),
    // Slice 11 Part C: the listing itself stays live and visible on
    // archiving (README C1) — only the enrol action changes.
    isArchived: programme.status === "ARCHIVED",
    title: content.headline,
    pitch: content.summary,
    video,
    fee: formatNaira(programme.feeMinor),
    feeNote: content.paymentNote,
    facts: [
      { label: "Length", value: `${programme.weeks} weeks` },
      { label: "Commitment", value: programme.weeklyHoursLabel },
      { label: "Delivery", value: programme.deliveryLabel },
    ],
    outcomes: content.outcomes,
    included: content.includes,
    syllabusMeta: `${programme.modules.length} module${programme.modules.length === 1 ? "" : "s"} · ${totalLectures} lecture${totalLectures === 1 ? "" : "s"}`,
    modules: programme.modules.map((m) => ({
      week: m.weekNumber,
      title: m.title,
      lectureCount: m.lectures.length,
      // Lecture titles only — no slide content, no media URLs (rule 4).
      lectures: m.lectures.map((l) => l.title),
    })),
    assessment: programme.assessmentWeightings.map((w) => ({
      item: ASSESSMENT_LABEL[w.kind] ?? w.kind,
      detail: ASSESSMENT_DETAIL[w.kind] ?? "",
      weight: `${w.weightPercent}%`,
    })),
  };
}

export async function getPublishedReviews() {
  const rows = await prisma.review.findMany({
    where: { state: "PUBLISHED" },
    orderBy: { orderIndex: "asc" },
    include: { programme: { select: { title: true, tier: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    authorTitle: r.authorTitle,
    quote: r.quote,
    rating: r.rating,
    programmeTitle: r.programme?.title ?? null,
    tierLabel: r.programme ? tierLabel(r.programme.tier) : null,
  }));
}

export async function getPublishedFaqs() {
  return prisma.faqEntry.findMany({
    where: { isPublished: true },
    orderBy: { orderIndex: "asc" },
  });
}
