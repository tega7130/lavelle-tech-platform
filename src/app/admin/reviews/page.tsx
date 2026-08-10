import { listReviewsForModeration } from "@/lib/review-reads";
import { ReviewModeration } from "@/components/admin/review-moderation";

export default async function Page() {
  const data = await listReviewsForModeration();
  return <ReviewModeration initial={data} />;
}
