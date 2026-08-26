import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { signOutCandidate } from "@/app/actions/candidate-auth";
import { listCandidateNotifications } from "@/lib/candidate-notifications";
import { getCandidateIdCard, getCandidateCohortStatus } from "@/lib/profile-reads";
import { CandidateShell } from "@/components/shell/candidate-shell";
import { SessionExpiryBanner } from "@/components/shell/session-expiry-banner";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  const initials = `${candidate.firstName[0] ?? ""}${candidate.lastName[0] ?? ""}`.toUpperCase();
  const [notifications, idCard] = await Promise.all([
    listCandidateNotifications(candidate.id),
    getCandidateIdCard(candidate.id),
  ]);
  const cohortStatus = await getCandidateCohortStatus(candidate.id, idCard?.tier);

  return (
    <>
      <SessionExpiryBanner expiresAt={candidate.sessionExpiresAt.toISOString()} signInPath="/sign-in" />
      <CandidateShell
        candidate={{
          name: `${candidate.firstName} ${candidate.lastName}`,
          initials,
          id: candidate.candidateNumber ?? candidate.applicantNumber,
          cohort: cohortStatus?.intakeLabel ? `${cohortStatus.intakeLabel} Intake` : undefined,
        }}
        enrolled={candidate.isEnrolled}
        onSignOut={signOutCandidate}
        initialNotifications={notifications}
      >
        {children}
      </CandidateShell>
    </>
  );
}
