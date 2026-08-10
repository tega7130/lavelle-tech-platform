import { getCurrentCandidate } from "@/lib/candidate-session";
import { CandidateSupport } from "@/components/portal/candidate-support";

export default async function Page() {
  const candidate = await getCurrentCandidate();
  if (!candidate) return null; // proxy already gates /portal/*
  return <CandidateSupport candidateName={`${candidate.firstName} ${candidate.lastName}`} />;
}
