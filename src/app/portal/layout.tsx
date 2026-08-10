import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { signOutCandidate } from "@/app/actions/candidate-auth";
import { CandidateShell } from "@/components/shell/candidate-shell";
import { SessionExpiryBanner } from "@/components/shell/session-expiry-banner";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  const initials = `${candidate.firstName[0] ?? ""}${candidate.lastName[0] ?? ""}`.toUpperCase();

  return (
    <>
      <SessionExpiryBanner expiresAt={candidate.sessionExpiresAt} signInPath="/sign-in" />
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
    </>
  );
}
