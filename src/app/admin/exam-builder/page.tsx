import { listExamsForBuilder, listExamBank } from "@/lib/exam-reads";
import { ExamBuilder } from "@/components/admin/exam-builder";

export default async function Page({ searchParams }: { searchParams: Promise<{ examId?: string }> }) {
  const { examId: requestedExamId } = await searchParams;
  const exams = await listExamsForBuilder();
  const examId = requestedExamId ?? exams[0]?.id;

  if (!examId) {
    return (
      <div className="max-w-[900px] text-center py-16">
        <div className="font-heading font-semibold text-[16px]">No programmes have an examination yet</div>
        <p className="text-neutral-600 text-[13px] mt-1.5">An examination is created for a programme from its record — see Programmes.</p>
      </div>
    );
  }

  const bank = await listExamBank(examId);
  return <ExamBuilder exams={exams} bank={bank} />;
}
