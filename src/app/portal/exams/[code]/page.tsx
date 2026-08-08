import { notFound } from "next/navigation";
import { getExamDetail, getExamIdByProgrammeCode } from "@/lib/exam-candidate-reads";
import { ExamDetail } from "@/components/portal/exam-detail";

// Deliberately no requireEnrolledPage() gate — exam-only registration is
// a first-class pathway (Slice 06 rule 14).
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const examId = await getExamIdByProgrammeCode(code);
  if (!examId) notFound();
  const detail = await getExamDetail(examId);
  return <ExamDetail detail={detail} programmeCode={code} />;
}
