import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getCredentialsPageData } from "@/lib/credentials-page-reads";
import { Credentials } from "@/components/portal/credentials";

// Deliberately no requireEnrolledPage() gate — an exam-only candidate who
// never enrolled can still hold a valid EXAMINATION_ONLY credential
// (Slice 07 rule 4), so must be able to see it here.
export default async function Page() {
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");
  const data = await getCredentialsPageData(candidate.id);
  return <Credentials data={data} />;
}
