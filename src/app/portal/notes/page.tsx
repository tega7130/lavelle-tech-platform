import { requireEnrolledPage } from "@/lib/candidate-session";
import { getCandidateNotes } from "@/lib/notes-reads";
import { NotesList } from "@/components/portal/notes-list";

// Layer 2 of the applicant gate (Handoff 01 rule 5) — the proxy already
// redirects here, this re-checks independently.
export default async function Page() {
  const candidate = await requireEnrolledPage();
  const groups = await getCandidateNotes(candidate.id);
  return <NotesList groups={groups} />;
}
