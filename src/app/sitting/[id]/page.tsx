import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getSittingForCandidate } from "@/lib/exam-candidate-reads";
import { NotYourSittingError } from "@/lib/exam-sitting-actions";
import { ExamSitting } from "@/components/portal/exam-sitting";

// Deliberately outside /portal — a timed sitting is its own full-window
// experience, no shell chrome, same precedent as /learn's course player.
// Layer 2 of the applicant gate re-implemented here directly since proxy's
// matcher only covers /portal and /admin.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  let data: Awaited<ReturnType<typeof getSittingForCandidate>>;
  try {
    data = await getSittingForCandidate(id, candidate.id);
  } catch (e) {
    if (e instanceof NotYourSittingError) redirect("/portal/exams");
    throw e;
  }

  if (data.sitting.state !== "IN_PROGRESS") {
    redirect(`/portal/exams/${data.programme.code}`);
  }

  return <ExamSitting data={data} />;
}
