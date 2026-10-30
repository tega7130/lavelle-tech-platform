import Link from "next/link";
import { getAzubiAnalytics } from "@/lib/azubi-reads";
import { AzubiAdminTabs } from "@/components/admin/azubi/azubi-admin-tabs";
import { AzubiBarList, AzubiWeeklyBars } from "@/components/admin/azubi/azubi-charts";

const AREA_LABELS: Record<string, string> = {
  corporate_commercial: "Corporate and commercial",
  litigation_dispute: "Litigation and dispute resolution",
  property_land: "Property and land",
  research_policy: "Research and policy",
  other: "Other",
};

const PIPELINE_LABELS: Record<string, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlisted",
  STATUS_CONFIRMED: "Status confirmed",
  MATCHED: "Matched",
  PLACED: "Placed",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

function KpiCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <div className="border border-divider rounded-md p-[var(--space-3)]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">{label}</div>
      <div className="font-heading text-2xl mt-1 text-text">{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block no-underline hover:border-accent-300">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function AzubiAnalyticsPage() {
  const { totals, pipelineCounts, areaCounts, weekBuckets, organizations } = await getAzubiAnalytics();

  const pipelineItems = Object.entries(PIPELINE_LABELS).map(([key, label]) => ({ label, value: pipelineCounts[key] ?? 0 }));
  const areaItems = Object.entries(areaCounts)
    .map(([key, value]) => ({ label: AREA_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);
  const orgCapacityItems = organizations
    .filter((o) => o.capacity != null)
    .map((o) => ({ label: o.name, value: Math.round((o.assigned / Math.max(1, o.capacity ?? 1)) * 100) }));

  return (
    <div className="max-w-[1100px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation</div>
      <h1 className="font-heading text-2xl mt-0.5">Analytics</h1>
      <AzubiAdminTabs />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[var(--space-3)] mb-[var(--space-6)]">
        <KpiCard label="Total fellows" value={totals.fellows} href="/admin/azubi/applications" />
        <KpiCard label="Unassigned" value={totals.unassigned} href="/admin/azubi/applications?poolStatus=unassigned" />
        <KpiCard label="Assigned" value={totals.assigned} href="/admin/azubi/applications?poolStatus=assigned" />
        <KpiCard label="Suspended" value={totals.suspended} href="/admin/azubi/applications?poolStatus=suspended" />
        <KpiCard label="Organizations" value={totals.organizations} href="/admin/azubi/organizations" />
        <KpiCard label="Supervisors" value={totals.supervisors} href="/admin/azubi/supervisors" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-5)]">
        <section className="border border-divider rounded-md p-[var(--space-4)]">
          <h2 className="font-heading text-base mb-[var(--space-3)]">Applications, last 12 weeks</h2>
          <AzubiWeeklyBars buckets={weekBuckets} />
        </section>

        <section className="border border-divider rounded-md p-[var(--space-4)]">
          <h2 className="font-heading text-base mb-[var(--space-3)]">Fellows by pipeline stage</h2>
          <AzubiBarList items={pipelineItems} />
        </section>

        <section className="border border-divider rounded-md p-[var(--space-4)]">
          <h2 className="font-heading text-base mb-[var(--space-3)]">Practice-area interest</h2>
          <AzubiBarList items={areaItems} barColor="var(--color-azubi-apricot, #e8a159)" />
        </section>

        <section className="border border-divider rounded-md p-[var(--space-4)]">
          <h2 className="font-heading text-base mb-[var(--space-3)]">Organization capacity used (%)</h2>
          {orgCapacityItems.length === 0 ? (
            <p className="text-[13px] text-neutral-600">No organization has set a capacity yet.</p>
          ) : (
            <AzubiBarList items={orgCapacityItems} barColor="#0f766e" />
          )}
        </section>
      </div>
    </div>
  );
}
