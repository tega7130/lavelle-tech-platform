"use client";

import * as React from "react";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { AssessmentIcon } from "@/components/icons";
import { tierLabel } from "@/lib/format";
import type { getCandidateResults } from "@/lib/marking-reads";

type Results = Awaited<ReturnType<typeof getCandidateResults>>["results"];
type Scale = Awaited<ReturnType<typeof getCandidateResults>>["scale"];

const BAND_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  DISTINCTION: "success",
  MERIT: "accent",
  PASS: "warning",
  REFER: "danger",
};

const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };

function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

export function AssessmentResults({ results, scale }: { results: Results; scale: Scale }) {
  const [open, setOpen] = React.useState<Set<string>>(new Set(results[0] ? [results[0].enrolmentId] : []));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (results.length === 0) {
    return (
      <div className="max-w-[640px] mx-auto text-center py-16">
        <div className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto mb-3">
          <AssessmentIcon width={20} height={20} />
        </div>
        <div className="font-heading font-semibold text-[16px]">No results recorded yet</div>
        <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[48ch] mx-auto">
          Quiz scores, marked drafting exercises and examination results appear here as they are released. Your
          first module quiz opens with Module 1.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px]">
      <h3 className="mt-0">Results by programme</h3>
      <div className="flex flex-col gap-[var(--space-3)]">
        {results.map((r) => {
          const isOpen = open.has(r.enrolmentId);
          const rows = [
            ...r.quizRows.map((q) => ({ title: q.title, type: "Quiz", module: q.module, date: q.date, score: q.scorePercent, weight: q.weight, band: null as string | null })),
            ...r.draftingRows.map((d) => ({ title: d.title, type: "Drafting", module: d.module, date: d.date, score: d.scorePercent, weight: d.weight, band: d.band })),
          ].sort((a, b) => (a.date && b.date ? a.date.getTime() - b.date.getTime() : 0));

          return (
            <Card key={r.enrolmentId} elev="sm" className="p-0 gap-0 overflow-hidden">
              <button
                onClick={() => toggle(r.enrolmentId)}
                className="flex items-center gap-[var(--space-4)] px-[var(--space-5)] py-[var(--space-4)] text-left cursor-pointer w-full"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-semibold text-[15px]">{r.programme.title}</span>
                    <Tag variant="accent">{tierLabel(r.programme.tier)}</Tag>
                  </div>
                  <div className="text-neutral-500 text-[12px] mt-0.5">
                    {r.quizRows.length + r.draftingRows.length} assessment{r.quizRows.length + r.draftingRows.length === 1 ? "" : "s"} marked
                  </div>
                </div>
                <div className="text-right flex-none">
                  <div className="font-heading font-bold text-[18px] leading-none">{r.result?.finalPercent != null ? `${r.result.finalPercent}%` : "—"}</div>
                  <div className="text-neutral-500 text-[10px] tracking-[0.06em] uppercase mt-0.5">Weighted</div>
                </div>
                <Tag variant={r.result?.band ? (BAND_TAG[r.result.band] as TagVariant) : "neutral"} className="flex-none font-semibold">
                  {r.result?.band ? BAND_LABEL[r.result.band] : "In progress"}
                </Tag>
              </button>

              {isOpen && (
                <div className="border-t border-dashed border-neutral-300">
                  <div className="grid grid-cols-4 max-[600px]:grid-cols-2 gap-[var(--space-3)] px-[var(--space-5)] py-[var(--space-4)]">
                    <div className="p-3 rounded-md bg-neutral-100">
                      <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Quizzes</div>
                      <div className="font-heading font-semibold text-[14px] mt-0.5">{r.quizRows.length}</div>
                    </div>
                    <div className="p-3 rounded-md bg-neutral-100">
                      <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Drafting</div>
                      <div className="font-heading font-semibold text-[14px] mt-0.5">{r.draftingRows.length} marked</div>
                    </div>
                    <div className="p-3 rounded-md bg-neutral-100">
                      <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Examination</div>
                      <div className="font-heading font-semibold text-[14px] mt-0.5">{r.result?.examinationPercent != null ? `${r.result.examinationPercent}%` : "Not yet sat"}</div>
                    </div>
                    <div className="p-3 rounded-md bg-neutral-100">
                      <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Weighted so far</div>
                      <div className="font-heading font-semibold text-[14px] mt-0.5">{r.result?.finalPercent != null ? `${r.result.finalPercent}%` : "—"}</div>
                    </div>
                  </div>

                  <Table>
                    <Thead>
                      <Tr>
                        <Th className="pl-[var(--space-5)]">Assessment</Th>
                        <Th>Type</Th>
                        <Th>Module</Th>
                        <Th>Date</Th>
                        <Th>Score</Th>
                        <Th>Weight</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {rows.map((row, i) => (
                        <Tr key={i}>
                          <Td className="pl-[var(--space-5)]">{row.title}</Td>
                          <Td>{row.type}</Td>
                          <Td>{row.module}</Td>
                          <Td>{fmtDate(row.date)}</Td>
                          <Td className="tabular-nums">{row.score != null ? `${row.score}%` : "—"}</Td>
                          <Td>{row.weight != null ? `${row.weight}%` : "—"}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>

                  <div className="px-[var(--space-5)] py-[var(--space-4)] border-t border-dashed border-neutral-300 text-[11.5px] text-neutral-500">
                    {!r.result
                      ? "No assessments have been marked yet."
                      : r.result.isProvisional
                        ? "This is a provisional, weighted average of what's been marked so far. The examination is not yet included."
                        : `Final mark ${r.result.finalPercent}% — ${r.result.band ? BAND_LABEL[r.result.band] : ""}.`}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card elev="sm" className="mt-[var(--space-6)]">
        <CardKicker>Grading scale</CardKicker>
        <div className="grid grid-cols-4 max-[600px]:grid-cols-2 gap-[var(--space-3)] mt-2">
          {scale.map((b, i) => {
            const upper = i === 0 ? null : scale[i - 1]!.minPercent - 1;
            const range = i === 0 ? `${b.minPercent}% and above` : b.minPercent === 0 ? `Below ${upper! + 1}% — resit required` : `${b.minPercent}–${upper}%`;
            return (
              <div key={b.band} className="p-3 rounded-md bg-neutral-100">
                <div className="font-heading font-semibold text-[14px]">{b.label}</div>
                <div className="text-neutral-500 text-[11.5px]">{range}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
