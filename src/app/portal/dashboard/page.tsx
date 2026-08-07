import { getCurrentCandidate } from "@/lib/candidate-session";
import { redirect } from "next/navigation";
import { ApplicantDashboard } from "@/components/portal/applicant-dashboard";
import { EnrolledDashboard } from "@/components/portal/enrolled-dashboard";
import { getEnrolledSummary } from "@/lib/catalogue-reads";

export default async function Page() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  if (!candidate.isEnrolled) return <ApplicantDashboard candidate={candidate} />;

  const summary = await getEnrolledSummary(candidate.id);
  return <EnrolledDashboard candidate={candidate} summary={summary} />;
}
