import { redirect } from "next/navigation";
import { requireEnrolledPage } from "@/lib/candidate-session";
import { getEnrolledSummary } from "@/lib/catalogue-reads";
import { getProgrammeOverview } from "@/lib/player-reads";
import { ProgrammeOverview } from "@/components/portal/programme-overview";

// Layer 2 of the applicant gate (Handoff 01 rule 5) — the proxy already
// redirects here, this re-checks independently.
export default async function Page() {
  const candidate = await requireEnrolledPage();
  const summary = await getEnrolledSummary(candidate.id);
  const primary = summary.enrolments[0];
  if (!primary) redirect("/portal/dashboard");

  const overview = await getProgrammeOverview(candidate.id, primary.id);
  return <ProgrammeOverview overview={overview} />;
}
