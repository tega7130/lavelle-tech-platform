import { requireEnrolledPage } from "@/lib/candidate-session";
import { listDeadlines } from "@/lib/player-reads";
import { DeadlinesList } from "@/components/portal/deadlines-list";

// Layer 2 of the applicant gate (Handoff 01 rule 5) — the proxy already
// redirects here, this re-checks independently.
export default async function Page() {
  const candidate = await requireEnrolledPage();
  const deadlines = await listDeadlines(candidate.id);
  return <DeadlinesList deadlines={deadlines} />;
}
