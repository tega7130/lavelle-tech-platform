import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { signOutCandidate } from "@/app/actions/candidate-auth";
import { CandidateShell } from "@/components/shell/candidate-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  const initials = `${candidate.firstName[0] ?? ""}${candidate.lastName[0] ?? ""}`.toUpperCase();

  return (
    <CandidateShell
      candidate={{
        name: `${candidate.firstName} ${candidate.lastName}`,
        initials,
        id: candidate.candidateNumber ?? candidate.applicantNumber,
      }}
      enrolled={candidate.isEnrolled}
      onSignOut={signOutCandidate}
    >
      {children}
    </CandidateShell>
  );
}
