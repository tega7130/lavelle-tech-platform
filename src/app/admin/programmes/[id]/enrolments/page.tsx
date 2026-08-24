import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEnrolmentsByProgramme, summariseEnrolments } from "@/lib/enrolment-reads";
import { getCurrentStaff } from "@/lib/staff-session";
import { buttonClassName } from "@/components/ui/button";
import { ProgrammeEnrolmentsTable } from "@/components/admin/programme-enrolments-table";

export default async function ProgrammeEnrolmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [programme, rows, currentStaff] = await Promise.all([
    prisma.programme.findUnique({ where: { id }, select: { id: true, code: true, title: true } }),
    getEnrolmentsByProgramme(id),
    getCurrentStaff(),
  ]);
  if (!programme) notFound();

  const stats = summariseEnrolments(rows);
  const canReset = currentStaff?.permissions.includes("RESET_CANDIDATE_PROGRESS") ?? false;

  return (
    <div className="max-w-[1280px]">
      <div className="mb-4">
        <Link href="/admin/programmes" className="text-[12px] text-neutral-500 hover:text-neutral-700 no-underline">
          &larr; Programmes
        </Link>
        <div className="flex items-center justify-between gap-4 mt-1 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">{programme.code}</div>
            <h1 className="font-heading text-2xl mt-0.5">{programme.title} — Enrolments</h1>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/programmes/${programme.id}/assessments`} className={buttonClassName("secondary")}>
              Assessment performance
            </Link>
            <Link href={`/admin/programmes/${programme.id}/edit`} className={buttonClassName("secondary")}>
              Edit programme
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-[var(--space-5)]">
        <SummaryCard label="Total learners" value={stats.total} />
        <SummaryCard label="Yet to start" value={stats.notStarted} />
        <SummaryCard label="In progress" value={stats.inProgress} />
        <SummaryCard label="Completed" value={stats.completed} />
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No one is enrolled in this programme yet</div>
        </div>
      ) : (
        <ProgrammeEnrolmentsTable rows={rows} canReset={canReset} />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-divider bg-bg p-4">
      <div className="text-[11px] tracking-[0.05em] uppercase text-neutral-500">{label}</div>
      <div className="font-heading text-2xl mt-1 tabular-nums">{value}</div>
    </div>
  );
}
