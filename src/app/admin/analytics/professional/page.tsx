import { getProfessionalDetailsAnalytics } from "@/lib/professional-analytics";
import { Card, CardKicker } from "@/components/ui/card";
import { requireStaffSession } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { LocationCleanupPanel } from "@/components/admin/location-cleanup-panel";

export default async function ProfessionalDetailsAnalyticsPage() {
  const [data, user] = await Promise.all([getProfessionalDetailsAnalytics(), requireStaffSession()]);
  const canEdit = user.permissions.includes(Permission.EDIT_CANDIDATE_DETAILS);

  return (
    <div className="max-w-[1000px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Analytics</div>
      <h1 className="font-heading text-2xl mt-0.5 mb-1">Professional details</h1>
      <p className="text-neutral-600 text-[13px] mb-[var(--space-6)] max-w-[68ch]">
        Aggregated from the professional-background step of the candidate profile — lawyer vs. non-lawyer split,
        years since call to the Bar, location, and the institutions and organisations candidates report.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-[var(--space-6)]">
        <SummaryCard label="Total candidates" value={data.totalCandidates} />
        <SummaryCard label="Profiles with details" value={data.profilesWithDetails} />
        <SummaryCard
          label="Completion rate"
          value={data.completionRate != null ? `${data.completionRate}%` : "—"}
        />
      </div>

      <div className="mb-[var(--space-6)]">
        <div className="font-heading font-semibold text-[14px] mb-3">Lawyers vs. non-lawyers</div>
        <div className="grid grid-cols-2 gap-3">
          <Card elev="sm">
            <CardKicker>Lawyers</CardKicker>
            <div className="font-heading text-2xl mt-1 tabular-nums">{data.lawyerSplit.lawyers}</div>
            <div className="text-[12px] text-neutral-500 mt-0.5">
              {data.lawyerSplit.lawyerPercent}% &middot; practising or in-house counsel
            </div>
          </Card>
          <Card elev="sm">
            <CardKicker>Non-lawyers</CardKicker>
            <div className="font-heading text-2xl mt-1 tabular-nums">{data.lawyerSplit.nonLawyers}</div>
            <div className="text-[12px] text-neutral-500 mt-0.5">
              {data.lawyerSplit.nonLawyerPercent}% &middot; graduates, students, regulated non-lawyers, other
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-[var(--space-6)]">
        <div>
          <div className="font-heading font-semibold text-[14px] mb-3">Professional status</div>
          {data.byProfessionalStatus.length === 0 ? (
            <EmptyState />
          ) : (
            <DistributionList items={data.byProfessionalStatus} />
          )}
        </div>

        <div>
          <div className="font-heading font-semibold text-[14px] mb-3">Years of experience (practising lawyers)</div>
          {data.byExperienceBand.length === 0 ? (
            <EmptyState />
          ) : (
            <DistributionList items={data.byExperienceBand} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-[var(--space-6)]">
        <div>
          <div className="font-heading font-semibold text-[14px] mb-3">Top locations (place of practice)</div>
          {data.topLocations.length === 0 ? (
            <EmptyState />
          ) : (
            <NamedCountList items={data.topLocations} />
          )}
        </div>

        <div>
          <div className="font-heading font-semibold text-[14px] mb-3">Year of call, by decade</div>
          {data.yearOfCallByDecade.length === 0 ? (
            <EmptyState />
          ) : (
            <NamedCountList items={data.yearOfCallByDecade} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="font-heading font-semibold text-[14px] mb-3">Top institutions (graduates &amp; students)</div>
          {data.topInstitutions.length === 0 ? (
            <EmptyState />
          ) : (
            <NamedCountList items={data.topInstitutions} />
          )}
        </div>

        <div>
          <div className="font-heading font-semibold text-[14px] mb-3">Top organisations</div>
          {data.topOrganisations.length === 0 ? (
            <EmptyState />
          ) : (
            <NamedCountList items={data.topOrganisations} />
          )}
        </div>
      </div>

      {canEdit && (
        <div className="mt-[var(--space-6)] pt-[var(--space-6)] border-t border-dashed border-neutral-300">
          <div className="font-heading font-semibold text-[14px] mb-1">Data cleanup</div>
          <p className="text-neutral-600 text-[12.5px] mb-3 max-w-[68ch]">
            Historical place-of-practice entries were free text, so the same state can appear under several
            spellings (&ldquo;Lagos&rdquo;, &ldquo;LAGOS&rdquo;, &ldquo;Lagos State, Nigeria&rdquo;). This merges
            confidently-recognized variants into the standard form the new dropdown writes — anything ambiguous is
            left untouched.
          </p>
          <LocationCleanupPanel />
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card elev="sm">
      <CardKicker>{label}</CardKicker>
      <div className="font-heading text-2xl mt-1 tabular-nums">{value}</div>
    </Card>
  );
}

function EmptyState() {
  return <div className="text-neutral-400 text-[13px] border border-divider rounded-md p-3.5">No data yet</div>;
}

function DistributionList({ items }: { items: { key: string; label: string; count: number; percent: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="border border-divider rounded-md overflow-hidden">
      {items.map((i) => (
        <div key={i.key} className="flex items-center gap-3 px-3.5 py-3 border-b border-dashed border-neutral-300 last:border-b-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 text-[13px] mb-1.5">
              <span className="text-text truncate">{i.label}</span>
              <span className="tabular-nums text-neutral-600 flex-none">
                {i.count} &middot; {i.percent}%
              </span>
            </div>
            <div className="h-[6px] rounded-full bg-neutral-200 overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(i.count / max) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NamedCountList({ items }: { items: { name: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="border border-divider rounded-md overflow-hidden">
      {items.map((i) => (
        <div key={i.name} className="flex items-center gap-3 px-3.5 py-3 border-b border-dashed border-neutral-300 last:border-b-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 text-[13px] mb-1.5">
              <span className="text-text truncate">{i.name}</span>
              <span className="tabular-nums text-neutral-600 flex-none">{i.count}</span>
            </div>
            <div className="h-[6px] rounded-full bg-neutral-200 overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(i.count / max) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
