import { redirect } from "next/navigation";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getExamResultForCandidate } from "@/lib/exam-candidate-reads";
import { NotYourSittingError } from "@/lib/exam-sitting-actions";
import { ExamResult } from "@/components/portal/exam-result";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");

  let data: Awaited<ReturnType<typeof getExamResultForCandidate>>;
  try {
    data = await getExamResultForCandidate(id, candidate.id);
  } catch (e) {
    if (e instanceof NotYourSittingError) redirect("/portal/exams");
    throw e;
  }

  if (data.sitting.state !== "RELEASED") {
    redirect(`/portal/exams/${data.programme.code}`);
  }

  return <ExamResult data={data} />;
}
