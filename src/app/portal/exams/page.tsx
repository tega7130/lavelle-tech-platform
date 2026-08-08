import { listExamsForCandidate } from "@/lib/exam-candidate-reads";
import { ExamCatalogue } from "@/components/portal/exam-catalogue";

// Deliberately no requireEnrolledPage() gate — exam-only registration is
// a first-class pathway (Slice 06 rule 14), so an applicant who never
// enrolled must still be able to browse and register here.
export default async function Page() {
  const exams = await listExamsForCandidate();
  return <ExamCatalogue exams={exams} />;
}
