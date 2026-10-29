import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getLawyerWebsitePreview } from "@/lib/lawyer-website-reads";
import { LawyerSiteView } from "@/components/site/lawyer-site-view";

export default async function LawyerWebsitePreviewPage() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  const site = await getLawyerWebsitePreview(candidate.id);
  if (!site) redirect("/portal/website");

  return <LawyerSiteView {...site} isPreview />;
}
