import Link from "next/link";
import { getDashboardSummary } from "@/lib/dashboard-analytics";

const QUICK_LINKS = [
  { href: "/admin/analytics/cohorts", label: "Monthly cohorts", description: "Enrolments by month, broken down per programme" },
  { href: "/admin/analytics/funnel", label: "Candidate funnel", description: "Registered → verified → paid → enrolled → completed → certified" },
  { href: "/admin/staff/performance", label: "Staff performance", description: "Marking turnaround, invigilation, support, publishing" },
  { href: "/admin/certificates", label: "Certificates", description: "Issued, revoked, band breakdown, verification checks" },
];

export default async function AnalyticsDashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="max-w-[1100px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Analytics</div>
      <h1 className="font-heading text-2xl mt-0.5 mb-[var(--space-5)]">Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-[var(--space-6)]">
        <SummaryCard label="Total candidates" value={summary.totalCandidates} />
        <SummaryCard label="Active enrolments" value={summary.activeEnrolments} />
        <SummaryCard label="Certificates issued" value={summary.certificatesIssued} />
        <SummaryCard
          label="Overall completion rate"
          value={summary.overallCompletionRate != null ? `${summary.overallCompletionRate}%` : "—"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="font-heading font-semibold text-[14px] mb-3">Reports</div>
          <div className="flex flex-col gap-2">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block rounded-md border border-divider p-3.5 no-underline hover:bg-neutral-100 transition-colors"
              >
                <div className="text-[13.5px] font-medium text-text">{l.label}</div>
                <div className="text-[12px] text-neutral-500 mt-0.5">{l.description}</div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="font-heading font-semibold text-[14px] mb-3">Top programmes by enrolment</div>
          {summary.topProgrammes.length === 0 ? (
            <div className="text-neutral-400 text-[13px] border border-divider rounded-md p-3.5">No enrolments yet</div>
          ) : (
            <div className="border border-divider rounded-md overflow-hidden">
              {summary.topProgrammes.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/programmes/${p.id}/enrolments`}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-dashed border-neutral-300 last:border-b-0 no-underline hover:bg-neutral-100 transition-colors"
                >
                  <div>
                    <div className="text-[13.5px] text-text">{p.title}</div>
                    <div className="text-[11px] text-neutral-500">{p.code}</div>
                  </div>
                  <div className="text-[13px] tabular-nums text-neutral-600 flex-none">{p.enrolled} enrolled</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-divider bg-bg p-4">
      <div className="text-[11px] tracking-[0.05em] uppercase text-neutral-500">{label}</div>
      <div className="font-heading text-2xl mt-1 tabular-nums">{value}</div>
    </div>
  );
}
