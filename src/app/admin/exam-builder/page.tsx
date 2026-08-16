import { listExamsForBuilder, listExamBank } from "@/lib/exam-reads";
import { ExamBuilder, NewExamEmptyState } from "@/components/admin/exam-builder";

export default async function Page({ searchParams }: { searchParams: Promise<{ examId?: string }> }) {
  const { examId: requestedExamId } = await searchParams;
  const exams = await listExamsForBuilder();
  const examId = requestedExamId ?? exams[0]?.id;

  if (!examId) {
    return <NewExamEmptyState />;
  }

  const bank = await listExamBank(examId);
  return <ExamBuilder key={examId} exams={exams} bank={bank} />;
}
