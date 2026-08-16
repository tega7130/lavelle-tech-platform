import { getCurrentCandidate } from "@/lib/candidate-session";
import { redirect } from "next/navigation";
import { ApplicantDashboard } from "@/components/portal/applicant-dashboard";
import { EnrolledDashboard } from "@/components/portal/enrolled-dashboard";
import { getDashboardSummary } from "@/lib/dashboard-reads";
import { getCandidateIdCard, getCandidateCohortStatus } from "@/lib/profile-reads";

export default async function Page() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  if (!candidate.isEnrolled) return <ApplicantDashboard candidate={candidate} />;

  const idCard = await getCandidateIdCard(candidate.id);
  const [summary, cohortStatus] = await Promise.all([
    getDashboardSummary(candidate.id),
    getCandidateCohortStatus(candidate.id, idCard?.tier),
  ]);
  return <EnrolledDashboard candidate={candidate} summary={summary} cohortStatus={cohortStatus} />;
}
