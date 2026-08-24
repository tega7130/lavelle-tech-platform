import { Tag, type TagVariant } from "@/components/ui/tag";
import type { ExamStats } from "@/lib/assessment-analytics";

const BAND_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  DISTINCTION: "success",
  MERIT: "accent",
  PASS: "warning",
  REFER: "danger",
};
const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };

export function ExamStatsCards({ stats }: { stats: ExamStats }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Registered" value={stats.totalRegistrations} />
        <StatCard label="Started" value={stats.started} />
        <StatCard label="Submitted" value={stats.submitted} />
        <StatCard label="Released" value={stats.released} />
        <StatCard label="Forfeited / Expired" value={stats.forfeited + stats.expired} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pass rate (released)" value={stats.passRate != null ? `${stats.passRate}%` : "—"} />
        <StatCard label="Average score (released)" value={stats.averageScore != null ? `${stats.averageScore}%` : "—"} />
        <div className="rounded-md border border-divider bg-bg p-4 col-span-2">
          <div className="text-[11px] tracking-[0.05em] uppercase text-neutral-500 mb-2">Band breakdown</div>
          {stats.released === 0 ? (
            <span className="text-neutral-400 text-[13px]">No released results yet</span>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(BAND_LABEL) as (keyof typeof BAND_LABEL)[]).map((band) => (
                <Tag key={band} variant={BAND_TAG[band]}>
                  {BAND_LABEL[band]} · {stats.bandCounts[band as keyof typeof stats.bandCounts]}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-divider bg-bg p-4">
      <div className="text-[11px] tracking-[0.05em] uppercase text-neutral-500">{label}</div>
      <div className="font-heading text-2xl mt-1 tabular-nums">{value}</div>
    </div>
  );
}
