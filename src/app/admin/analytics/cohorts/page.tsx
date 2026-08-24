import Link from "next/link";
import { getEnrolmentsByMonth } from "@/lib/cohort-analytics";

export default async function CohortsPage() {
  const months = await getEnrolmentsByMonth();

  return (
    <div className="max-w-[1100px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Analytics</div>
      <h1 className="font-heading text-2xl mt-0.5 mb-1">Monthly cohorts</h1>
      <p className="text-neutral-600 text-[13px] mb-[var(--space-4)] max-w-[68ch]">
        Candidates grouped by the month they enrolled, across every programme. Open a month to see how it splits by
        programme.
      </p>

      {months.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No enrolments yet</div>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-divider py-[10px] pr-2 pl-[var(--space-4)] text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                  Month
                </th>
                <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                  Total enrolled
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
              {months.map((m) => (
                <tr key={m.monthKey} className="hover:bg-neutral-100">
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 pl-[var(--space-4)]">
                    <Link href={`/admin/analytics/cohorts/${m.monthKey}`} className="text-[13px] text-accent hover:underline no-underline">
                      {m.label}
                    </Link>
                  </td>
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px] tabular-nums">{m.total}</td>
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px] tabular-nums">{m.notStarted}</td>
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px] tabular-nums">{m.inProgress}</td>
                  <td className="border-b border-dashed border-neutral-300 py-[10px] pr-[var(--space-4)] text-[13px] tabular-nums">{m.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
