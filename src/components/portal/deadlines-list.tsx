import Link from "next/link";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { DeadlinesIcon } from "@/components/icons";
import type { listDeadlines } from "@/lib/player-reads";
import type { ComputedDeadlineState } from "@/lib/deadline-state";

type Deadlines = Awaited<ReturnType<typeof listDeadlines>>;

type TagStyle = "accent" | "neutral" | "success" | "warning" | "danger";

const STATE_STYLE: Record<ComputedDeadlineState, { accent: string; tag: TagStyle; label: string }> = {
  UPCOMING: { accent: "var(--color-accent-300)", tag: "neutral", label: "Upcoming" },
  DUE_SOON: { accent: "#f0d9a8", tag: "warning", label: "Due soon" },
  OVERDUE: { accent: "#f3c4bf", tag: "danger", label: "Overdue" },
  MET: { accent: "#bfe3cd", tag: "success", label: "Done" },
  WAIVED: { accent: "var(--color-neutral-300)", tag: "neutral", label: "Waived" },
};

const KIND_LABEL: Record<string, string> = {
  LECTURE_RELEASE: "Module opens",
  DRAFTING_DUE: "Drafting exercise",
  QUIZ_DUE: "Module quiz",
  EXAMINATION: "Examination",
};

export function DeadlinesList({ deadlines }: { deadlines: Deadlines }) {
  if (deadlines.length === 0) {
    return (
      <div className="max-w-[640px] mx-auto text-center py-16">
        <div className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto mb-3">
          <DeadlinesIcon width={20} height={20} />
        </div>
        <div className="font-heading font-semibold text-[16px]">Nothing is due</div>
        <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[48ch] mx-auto">
          Deadlines appear as modules open. Your next one will be listed here with the date it falls and the work it
          covers.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[860px]">
      <h1 className="font-heading text-2xl m-0 mb-[var(--space-5)]">Deadlines</h1>
      <div className="border border-divider rounded-md overflow-hidden">
        {deadlines.map((d) => {
          const style = STATE_STYLE[d.state];
          const day = d.dueAt.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "UTC" });
          const month = d.dueAt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase();
          return (
            <div
              key={d.id}
              className="flex items-center gap-[var(--space-4)] p-[var(--space-4)] border-b border-dashed border-neutral-300 last:border-b-0"
              style={{ borderLeft: `3px solid ${style.accent}` }}
            >
              <div className="w-[52px] text-center shrink-0">
                <div className="font-heading font-bold text-[19px] leading-none">{day}</div>
                <div className="text-[10.5px] tracking-[0.06em] uppercase text-neutral-500 mt-0.5">{month}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px]">{d.title}</div>
                <div className="text-neutral-500 text-[12px] mt-0.5">
                  {d.programmeTitle} &middot; {KIND_LABEL[d.kind] ?? d.kind}
                  {d.extendedReason ? ` · ${d.extendedReason}` : ""}
                </div>
              </div>
              <Tag variant={style.tag}>{style.label}</Tag>
              {d.kind !== "EXAMINATION" && (
                <Link
                  href={`/portal/programme?programme=${d.programmeCode}`}
                  className={buttonClassName("secondary", "shrink-0 h-[31px] px-[11px] text-xs")}
                >
                  View
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
