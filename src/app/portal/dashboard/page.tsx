import { getCurrentCandidate } from "@/lib/candidate-session";
import { redirect } from "next/navigation";
import { ApplicantDashboard } from "@/components/portal/applicant-dashboard";
import { ScreenPlaceholder } from "@/components/shell/placeholder";

export default async function Page() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  // The enrolled dashboard (programme progress, deadlines, credentialing
  // ladder) is a later slice — this slice only ships the applicant state.
  if (!candidate.isEnrolled) return <ApplicantDashboard candidate={candidate} />;
  return <ScreenPlaceholder title="Dashboard" />;
}
