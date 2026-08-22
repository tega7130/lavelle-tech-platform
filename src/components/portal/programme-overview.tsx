"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { LectureStateDot } from "@/components/portal/lecture-state-dot";
import { LockIcon } from "@/components/icons";
import { tierLabel } from "@/lib/format";
import type { getProgrammeOverview } from "@/lib/player-reads";

type Overview = Awaited<ReturnType<typeof getProgrammeOverview>>;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "modules", label: "Modules" },
] as const;

const ASSESSMENT_LABEL: Record<string, string> = { QUIZ: "Module quizzes", DRAFTING: "Drafting exercises", EXAMINATION: "Certifying examination" };

export function ProgrammeOverview({ overview }: { overview: Overview }) {
  const { enrolment, programme, modules, programmePercent, upNext } = overview;
  const [tab, setTab] = React.useState<(typeof TABS)[number]["key"]>("overview");
  const isComplete = programmePercent >= 100;

  return (
    <div className="max-w-[1000px] flex flex-col gap-[var(--space-6)]">
      <Card elev="md" className="p-0 overflow-hidden">
        <div className="p-[var(--space-6)] text-white relative" style={{ background: "linear-gradient(158deg, #0c356f, #08234a)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Tag variant="accent-2">{tierLabel(programme.tier)}</Tag>
            <span className="text-[11px] text-white/60">Week {modules.length}-module programme</span>
          </div>
          <div className="flex items-start justify-between gap-[var(--space-6)]">
            <div className="max-w-[56ch]">
              <h1 className="font-heading text-[26px] leading-tight m-0">{programme.title}</h1>
              <p className="text-white/70 text-[13px] mt-2 mb-0">{programme.summary}</p>
              <div className="flex gap-[var(--space-6)] mt-[var(--space-4)] text-[12px] text-white/60">
                <div>
                  <div className="text-white/45 text-[10px] uppercase tracking-[0.08em]">Cohort</div>
                  <div className="text-white mt-0.5">{enrolment.cohortId ? "Placed" : "Placement pending"}</div>
                </div>
                <div>
                  <div className="text-white/45 text-[10px] uppercase tracking-[0.08em]">Credits</div>
                  <div className="text-white mt-0.5">{programme.credits}</div>
                </div>
              </div>
              {isComplete ? (
                <div className="mt-[var(--space-5)] inline-flex items-center gap-2 bg-white/10 rounded-md px-4 py-2.5 text-[13px]">
                  Course complete — you&apos;re eligible to register for the certifying exam.
                </div>
              ) : upNext ? (
                <Link
                  href={`/learn/${enrolment.id}/${upNext.lectureId}`}
                  className={buttonClassName("primary", "mt-[var(--space-5)]")}
                >
                  Continue programme →
                </Link>
              ) : null}
            </div>
            <ProgressRing percent={programmePercent} sublabel="Done" className="bg-white/5" />
          </div>
        </div>
      </Card>

      {upNext && !isComplete && (
        <Card elev="sm">
          <CardKicker>Up next</CardKicker>
          <div className="flex items-center justify-between mt-1">
            <div>
              <div className="font-heading font-semibold text-[15px]">{upNext.lectureTitle}</div>
              <div className="text-neutral-500 text-[12px] mt-0.5">{upNext.moduleTitle}</div>
            </div>
            <Link href={`/learn/${enrolment.id}/${upNext.lectureId}`} className={buttonClassName("secondary")}>
              Open lecture
            </Link>
          </div>
        </Card>
      )}

      <div className="flex gap-1 border-b border-divider">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px cursor-pointer ${
              tab === t.key ? "border-accent text-accent" : "border-transparent text-neutral-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card elev="sm">
          <CardKicker>About this programme</CardKicker>
          <p className="text-[13px] text-neutral-700 mt-2 mb-0">{programme.summary}</p>
          <div className="grid grid-cols-3 gap-3 mt-[var(--space-4)] text-[13px]">
            <div>
              <div className="text-neutral-500 text-xs">Duration</div>
              <div>{programme.weeks} weeks</div>
            </div>
            <div>
              <div className="text-neutral-500 text-xs">Commitment</div>
              <div>{programme.weeklyHoursLabel}</div>
            </div>
            <div>
              <div className="text-neutral-500 text-xs">Delivery</div>
              <div>{programme.deliveryLabel}</div>
            </div>
          </div>
        </Card>
      )}

      {tab === "overview" && programme.assessmentWeightings.length > 0 && (
        <Card elev="sm">
          <CardKicker>How you&apos;ll be graded</CardKicker>
          <div className="flex flex-col gap-2 mt-2">
            {programme.assessmentWeightings
              .slice()
              .sort((a, b) => b.weightPercent - a.weightPercent)
              .map((w) => (
                <div key={w.kind} className="flex justify-between gap-4 pb-2 border-b border-dashed border-neutral-300 last:border-b-0 last:pb-0">
                  <span className="text-[13px] text-neutral-700">{ASSESSMENT_LABEL[w.kind] ?? w.kind}</span>
                  <span className="font-heading font-semibold text-[13px]">{w.weightPercent}%</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {tab === "modules" && (
        <div className="flex flex-col gap-[var(--space-3)]">
          {modules.map((mod) => (
            <Card key={mod.id} elev="sm">
              <div className="flex items-center justify-between">
                <div>
                  <CardKicker>Week {mod.weekNumber}</CardKicker>
                  <div className="font-heading font-semibold text-[15px] mt-0.5">{mod.title}</div>
                </div>
                <div className="text-right">
                  {!mod.isReleased ? (
                    <Tag variant="neutral" className="inline-flex items-center gap-1">
                      <LockIcon width={10} height={10} /> Not yet released
                    </Tag>
                  ) : (
                    <div className="text-[12px] text-neutral-500 tabular-nums">{mod.percent}% complete</div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-[var(--space-3)]">
                {mod.lectures.map((lec) => (
                  <Link
                    key={lec.id}
                    href={lec.isLocked ? "#" : `/learn/${enrolment.id}/${lec.id}`}
                    aria-disabled={lec.isLocked}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] ${
                      lec.isLocked ? "text-neutral-400 pointer-events-none" : "text-text hover:bg-neutral-100"
                    }`}
                  >
                    <LectureStateDot state={lec.state} isLocked={lec.isLocked} />
                    <span className="flex-1">{lec.title}</span>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
