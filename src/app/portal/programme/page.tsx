import { redirect } from "next/navigation";
import { requireEnrolledPage } from "@/lib/candidate-session";
import { getEnrolledSummary } from "@/lib/catalogue-reads";
import { getProgrammeOverview } from "@/lib/player-reads";
import { ProgrammeOverview } from "@/components/portal/programme-overview";

// Layer 2 of the applicant gate (Handoff 01 rule 5) — the proxy already
// redirects here, this re-checks independently.
export default async function Page({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  const candidate = await requireEnrolledPage();
  const { programme: code } = await searchParams;
  const summary = await getEnrolledSummary(candidate.id);
  // A candidate can have several enrolments — the ?programme= code picks
  // which one to open (item 13: opening one must never land on whichever
  // was enrolled in most recently). No match, or no code at all, falls
  // back to the most recent enrolment.
  const target = (code && summary.enrolments.find((e) => e.programme.code === code)) || summary.enrolments[0];
  if (!target) redirect("/portal/dashboard");

  const overview = await getProgrammeOverview(candidate.id, target.id);
  return <ProgrammeOverview overview={overview} />;
}
