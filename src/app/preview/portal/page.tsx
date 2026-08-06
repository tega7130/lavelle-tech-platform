import { CandidateShell } from "@/components/shell/candidate-shell";
import { ScreenPlaceholder } from "@/components/shell/placeholder";

/**
 * Auth/DB-free render of the candidate shell for local design-fidelity
 * review. Not linked from the app; not covered by the auth middleware.
 */
export default function PreviewPortalPage() {
  return (
    <CandidateShell
      candidate={{ name: "Chiamaka Okonji", initials: "CO", id: "LVL/2026/00291", cohort: "September 2026" }}
      enrolled
    >
      <ScreenPlaceholder title="Dashboard" />
    </CandidateShell>
  );
}
