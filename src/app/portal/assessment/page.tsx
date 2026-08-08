import { requireEnrolledPage } from "@/lib/candidate-session";
import { getCandidateResults } from "@/lib/marking-reads";
import { AssessmentResults } from "@/components/portal/assessment-results";

// Layer 2 of the applicant gate (Handoff 01 rule 5) — the proxy already
// redirects here, this re-checks independently.
export default async function Page() {
  const candidate = await requireEnrolledPage();
  const { results, scale } = await getCandidateResults(candidate.id);
  return <AssessmentResults results={results} scale={scale} />;
}
