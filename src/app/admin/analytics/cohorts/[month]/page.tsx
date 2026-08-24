import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthByProgrammeBreakdown } from "@/lib/cohort-analytics";

export default async function CohortMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!/^\d{4}-\d{2}$/.test(month)) notFound();

  const { month: summary, programmes } = await getMonthByProgrammeBreakdown(month);

  return (
    <div className="max-w-[1100px]">
      <Link href="/admin/analytics/cohorts" className="text-[12px] text-neutral-500 hover:text-neutral-700 no-underline">
        &larr; Monthly cohorts
      </Link>
      <h1 className="font-heading text-2xl mt-1 mb-[var(--space-4)]">{summary.label} cohort</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-[var(--space-5)]">
        <SummaryCard label="Total enrolled" value={summary.total} />
        <SummaryCard label="Yet to start" value={summary.notStarted} />
        <SummaryCard label="In progress" value={summary.inProgress} />
        <SummaryCard label="Completed" value={summary.completed} />
      </div>

      {programmes.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No enrolments in {summary.label}</div>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-divider py-[10px] pr-2 pl-[var(--space-4)] text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                  Programme
                </th>
                <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                  Enrolled
                </th>
                <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                  Yet to start
                </th>
                <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                  In progress
                </th>
                <th className="border-b border-divider py-[10px] pr-[var(--space-4)] text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                  Completed
                </th>
              </tr>
            </thead>
            <tbody>
              {programmes.map((p) => (
                <tr key={p.programmeId} className="hover:bg-neutral-100">
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 pl-[var(--space-4)]">
                    <Link href={`/admin/analytics/cohorts/${month}/${p.programmeId}`} className="text-[13px] text-accent hover:underline no-underline">
                      {p.programmeTitle}
                    </Link>
                    <div className="text-[11px] text-neutral-500">{p.programmeCode}</div>
                  </td>
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px] tabular-nums">{p.total}</td>
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px] tabular-nums">{p.notStarted}</td>
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px] tabular-nums">{p.inProgress}</td>
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-[var(--space-4)] text-[13px] tabular-nums">{p.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
