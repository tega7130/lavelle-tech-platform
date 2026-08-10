import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission, type ReviewState } from "@/generated/prisma/client";

function timeAgo(d: Date) {
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Admin: the three tabbed moderation queues (README D2), plus the summary line. */
export async function listReviewsForModeration() {
  await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);

  const [rows, publishedCount, avgRatingAgg, awaitingCount] = await Promise.all([
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: { programme: { select: { title: true } } },
    }),
    prisma.review.count({ where: { state: "PUBLISHED" } }),
    prisma.review.aggregate({ where: { state: "PUBLISHED" }, _avg: { rating: true } }),
    prisma.review.count({ where: { state: "PENDING" } }),
  ]);

  const byState = (state: ReviewState) =>
    rows
      .filter((r) => r.state === state)
      .map((r) => ({
        id: r.id,
        authorName: r.authorName,
        authorTitle: r.authorTitle,
        programmeTitle: r.programme?.title ?? null,
        quote: r.quote,
        rating: r.rating,
        state: r.state,
        provenance: r.state === "PUBLISHED" && r.moderatedAt ? `Live since ${r.moderatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : `Submitted ${timeAgo(r.createdAt)}`,
        declineReason: r.declineReason,
      }));

  return {
    pending: byState("PENDING"),
    published: byState("PUBLISHED"),
    declined: byState("DECLINED"),
    summary: {
      publishedCount,
      averageRating: avgRatingAgg._avg.rating != null ? Math.round(avgRatingAgg._avg.rating * 10) / 10 : null,
      awaitingCount,
    },
  };
}

/** Candidate: does this enrolment qualify to leave a review, and has one already been submitted? */
export async function getReviewEligibility(candidateId: string, enrolmentId: string) {
  const enrolment = await prisma.enrolment.findUnique({ where: { id: enrolmentId } });
  if (!enrolment || enrolment.candidateId !== candidateId) return { eligible: false, alreadySubmitted: false };
  if (enrolment.status !== "COMPLETED") return { eligible: false, alreadySubmitted: false };
  const existing = await prisma.review.findFirst({ where: { enrolmentId } });
  return { eligible: !existing, alreadySubmitted: !!existing };
}
