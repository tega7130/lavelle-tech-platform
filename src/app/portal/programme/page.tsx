import { redirect } from "next/navigation";
import { requireEnrolledPage } from "@/lib/candidate-session";
import { getEnrolledSummary } from "@/lib/catalogue-reads";
import { getProgrammeOverview, listCandidateProgrammes } from "@/lib/player-reads";
import { ProgrammeOverview } from "@/components/portal/programme-overview";
import { ProgrammesList } from "@/components/portal/programmes-list";

// Layer 2 of the applicant gate (Handoff 01 rule 5) — the proxy already
// redirects here, this re-checks independently.
export default async function Page({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  const candidate = await requireEnrolledPage();
  const { programme: code } = await searchParams;

  // No ?programme= at all: the list of everything the candidate holds
  // (Your Programmes). A code picks one to open — never falls back to
  // "most recent" silently (item 13: opening one must never land on
  // whichever was enrolled in most recently).
  if (!code) {
    const programmes = await listCandidateProgrammes(candidate.id);
    return <ProgrammesList programmes={programmes} />;
  }

  const summary = await getEnrolledSummary(candidate.id);
  const target = summary.enrolments.find((e) => e.programme.code === code);
  if (!target) redirect("/portal/programme");

  const overview = await getProgrammeOverview(candidate.id, target.id);
  return <ProgrammeOverview overview={overview} />;
}
