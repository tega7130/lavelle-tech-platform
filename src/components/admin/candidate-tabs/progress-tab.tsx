import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { tierLabel } from "@/lib/format";
import type { getCandidateProgress } from "@/lib/progress-admin-reads";

type Progress = Awaited<ReturnType<typeof getCandidateProgress>>;

const DEADLINE_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  MET: "success",
  WAIVED: "outline",
  OVERDUE: "danger",
  DUE_SOON: "warning",
  UPCOMING: "neutral",
};

export function CandidateProgressTab({ progress }: { progress: Progress }) {
  if (progress.length === 0) {
    return (
      <div className="text-center py-12 px-6 border border-divider rounded-md">
        <div className="font-heading font-semibold text-[15px]">No active enrolments to show progress for</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {progress.map((p) => (
        <Card key={p.enrolmentId} elev="sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <CardKicker>{tierLabel(p.tier)}</CardKicker>
              <div className="font-heading font-semibold text-[15px]">{p.programmeTitle}</div>
            </div>
            <div className="text-right">
              <div className="font-heading font-bold text-xl">{p.percentComplete}%</div>
              <div className="text-[11px] text-neutral-500">
                {p.completedLectures}/{p.totalLectures} lectures
              </div>
            </div>
          </div>

          {p.deadlines.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {p.deadlines.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-[12.5px]">
                  <span>{d.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 tabular-nums">
                      {new Date(d.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <Tag variant={DEADLINE_TAG[d.state] as TagVariant}>{d.state.replace(/_/g, " ")}</Tag>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
