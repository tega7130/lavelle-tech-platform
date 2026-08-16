import Link from "next/link";
import { getExamSummaryForAccess, listExamCandidates } from "@/lib/exam-reads";
import { listExamStaffAssignments, listAssignableStaffForExam } from "@/lib/exam-staff";
import { ExamCandidates } from "@/components/admin/exam-candidates";

export default async function Page({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const exam = await getExamSummaryForAccess(examId);
  const candidates = await listExamCandidates(examId);
  const [assignments, assignable] = exam.canManageStaff
    ? await Promise.all([listExamStaffAssignments(examId), listAssignableStaffForExam(examId)])
    : [[], []];

  return (
    <div className="max-w-[1200px] flex flex-col gap-[var(--space-5)]">
      <div>
        <Link href={`/admin/exam-builder?examId=${examId}`} className="text-[13px] text-accent">
          ← Back to exam builder
        </Link>
        <h2 className="mt-1 mb-0">
          {exam.programmeTitle} ({exam.programmeCode}) — Candidates
        </h2>
      </div>
      <ExamCandidates
        examId={examId}
        canManageStaff={exam.canManageStaff}
        candidates={candidates}
        assignments={assignments}
        assignable={assignable}
      />
    </div>
  );
}
