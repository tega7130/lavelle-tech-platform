import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getCandidateIdCard } from "@/lib/profile-reads";
import { getSignedAssetUrl } from "@/lib/storage";
import { ProfilePage } from "@/components/portal/profile-page";

export default async function Page() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  const idCard = await getCandidateIdCard(candidate.id);
  // Regenerated fresh on every render, never persisted — a signed GET URL
  // expires in minutes (src/lib/storage.ts).
  const photoUrl = candidate.profile?.photoUrl ? getSignedAssetUrl(candidate.profile.photoUrl) : null;

  return (
    <ProfilePage
      candidate={{
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        applicantNumber: candidate.applicantNumber,
        candidateNumber: candidate.candidateNumber,
        isEnrolled: candidate.isEnrolled,
      }}
      profile={candidate.profile}
      idCard={idCard}
      photoUrl={photoUrl}
    />
  );
}
