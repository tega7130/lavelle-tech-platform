import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthProgrammeDetail, monthLabel } from "@/lib/cohort-analytics";
import { getCurrentStaff } from "@/lib/staff-session";
import { ProgrammeEnrolmentsTable } from "@/components/admin/programme-enrolments-table";

export default async function CohortMonthProgrammePage({ params }: { params: Promise<{ month: string; programmeId: string }> }) {
  const { month, programmeId } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const [{ programmeTitle, rows }, currentStaff] = await Promise.all([getMonthProgrammeDetail(month, programmeId), getCurrentStaff()]);
  if (rows.length === 0) notFound();

  const canReset = currentStaff?.permissions.includes("RESET_CANDIDATE_PROGRESS") ?? false;

  return (
    <div className="max-w-[1280px]">
      <Link href={`/admin/analytics/cohorts/${month}`} className="text-[12px] text-neutral-500 hover:text-neutral-700 no-underline">
        &larr; {monthLabel(month)} cohort
      </Link>
      <h1 className="font-heading text-2xl mt-1 mb-[var(--space-4)]">
        {programmeTitle} — {monthLabel(month)} enrollees
      </h1>

      <ProgrammeEnrolmentsTable rows={rows} canReset={canReset} />
    </div>
  );
}
