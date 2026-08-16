"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { tierLabel, intakeLabel } from "@/lib/format";
import type { listCandidateProgrammes, ProgrammeListStatus } from "@/lib/player-reads";

type Programmes = Awaited<ReturnType<typeof listCandidateProgrammes>>;

const STATUS_META: Record<ProgrammeListStatus, { label: string; tag: "accent" | "neutral" | "accent-2"; stripe: "blue" | "gold" | "neutral" }> = {
  in_progress: { label: "In progress", tag: "accent", stripe: "blue" },
  not_started: { label: "Paid — not started", tag: "neutral", stripe: "neutral" },
  completed: { label: "Completed", tag: "accent-2", stripe: "gold" },
};

const FILTERS: { key: "all" | ProgrammeListStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In progress" },
  { key: "not_started", label: "Not started" },
  { key: "completed", label: "Completed" },
];

export function ProgrammesList({ programmes }: { programmes: Programmes }) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("all");
  const visible = filter === "all" ? programmes : programmes.filter((p) => p.status === filter);

  return (
    <div className="max-w-[900px]">
      <h1 className="font-heading text-2xl m-0 mb-1">Your programmes</h1>
      <p className="text-neutral-600 text-[13px] mb-[var(--space-5)]">
        Everything you have enrolled in, in progress or completed. Open a programme to see its overview, modules and
        assessments.
      </p>

      <div className="flex gap-1.5 mb-[var(--space-5)]">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-2 rounded-md text-[13px] font-medium cursor-pointer border ${
              filter === f.key ? "bg-accent-100 border-accent-300 text-accent-700" : "bg-bg border-neutral-300 text-text hover:bg-neutral-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card elev="sm" className="text-center py-12">
          <div className="text-[13px] text-neutral-600">No programmes in this view.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--space-4)]">
          {visible.map((p) => {
            const meta = STATUS_META[p.status];
            return (
              <Card key={p.enrolmentId} elev="sm" stripe={meta.stripe} className="p-[var(--space-5)]">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag variant="accent">{tierLabel(p.tier)}</Tag>
                      <Tag variant={meta.tag}>{meta.label}</Tag>
                    </div>
                    <div className="font-heading font-semibold text-[16px] mt-1.5">{p.programmeTitle}</div>
                    <div className="text-neutral-500 text-[12px] mt-1">
                      {p.programmeCode} &middot; {intakeLabel(p.intakeMonth, p.intakeYear)} intake
                      {p.enrolledAt && ` · enrolled ${p.enrolledAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`}
                    </div>
                  </div>
                  <Link href={`/portal/programme?programme=${p.programmeCode}`} className={buttonClassName("primary")}>
                    Open programme
                  </Link>
                </div>

                <div className="mt-[var(--space-4)] pt-[var(--space-3)] border-t border-dashed border-neutral-300">
                  <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <div className="text-neutral-500">
                      <span className="uppercase tracking-[0.06em] text-[10px]">Lectures</span>
                      <span className="ml-2 text-text tabular-nums">
                        {p.completedLectures} of {p.totalLectures}
                      </span>
                    </div>
                    {p.upNext && (
                      <div className="text-neutral-500 text-right">
                        <span className="uppercase tracking-[0.06em] text-[10px]">Next</span>
                        <span className="ml-2 text-text">
                          {p.upNext.moduleTitle} &middot; {p.upNext.lectureTitle}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 h-[6px] rounded-full bg-neutral-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.status === "completed" ? "bg-accent-2" : "bg-accent"}`}
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
