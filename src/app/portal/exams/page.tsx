import { requireEnrolledPage } from "@/lib/candidate-session";
import { ScreenPlaceholder } from "@/components/shell/placeholder";

// Layer 2 of the applicant gate (Handoff 01 rule 5) — the proxy already
// redirects here, this re-checks independently.
export default async function Page() {
  await requireEnrolledPage();
  return <ScreenPlaceholder title="Exams" />;
}
