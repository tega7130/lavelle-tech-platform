"use client";

import * as React from "react";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/field";
import {
  listInvigilationSittingsAction,
  getSittingConductDetailAction,
  clearSittingAction,
  referSittingAction,
} from "@/app/actions/invigilation";
import type { listInvigilationWindows, listInvigilationSittings, getSittingConductDetail } from "@/lib/invigilation-reads";

type WindowOption = Awaited<ReturnType<typeof listInvigilationWindows>>[number];
type SittingsData = Awaited<ReturnType<typeof listInvigilationSittings>>;
type SittingRow = SittingsData["rows"][number];
type Detail = Awaited<ReturnType<typeof getSittingConductDetail>>;

const REVIEW_TAG: Record<string, { label: string; variant: TagVariant | "success" | "warning" | "danger" }> = {
  PENDING: { label: "Awaiting review", variant: "neutral" },
  CLEARED: { label: "Cleared", variant: "success" },
  REFERRED: { label: "Referred", variant: "danger" },
};

function flagTag(count: number): { variant: TagVariant | "success" | "warning" | "danger" } {
  if (count === 0) return { variant: "neutral" };
  if (count < 4) return { variant: "warning" };
  return { variant: "danger" };
}

function fmtDateTime(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Invigilation({ windows }: { windows: WindowOption[] }) {
  const [windowId, setWindowId] = React.useState(windows[0]?.id ?? "");
  const [data, setData] = React.useState<SittingsData | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [finding, setFinding] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadWindow = React.useCallback(async (id: string) => {
    if (!id) return;
    const d = await listInvigilationSittingsAction(id);
    setData(d);
    setSelectedId(d.rows[0]?.sittingId ?? null);
  }, []);

  const loadDetail = React.useCallback(async (sittingId: string) => {
    const d = await getSittingConductDetailAction(sittingId);
    setDetail(d);
    setFinding(d.invigilatorFinding ?? "");
    setError(null);
  }, []);

  React.useEffect(() => {
    if (windowId) void loadWindow(windowId);
  }, [windowId, loadWindow]);

  React.useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function act(kind: "clear" | "refer") {
    if (!selectedId || !finding.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "clear") await clearSittingAction(selectedId, finding);
      else await referSittingAction(selectedId, finding);
      await loadWindow(windowId);
      await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that review.");
    } finally {
      setBusy(false);
    }
  }

  if (windows.length === 0) {
    return (
      <Card elev="sm" className="max-w-[560px] p-8 text-center">
        <div className="font-heading font-semibold text-[15px]">No sittings to review yet</div>
        <div className="text-neutral-500 text-[12.5px] mt-1.5">
          Every window's sittings appear here once candidates begin submitting papers.
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-[1400px] flex flex-col gap-[var(--space-5)]">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <CardKicker>Conduct review</CardKicker>
          <div className="font-heading font-semibold text-[17px] mt-0.5">{data?.windowLabel ?? "…"}</div>
          <p className="text-neutral-600 text-[12.5px] leading-relaxed mt-1 max-w-[74ch]">
            Every sitting is monitored for full-screen exits and tab switches. These are observations, not findings —
            a flag is a prompt to look, and only a human decides what it means.
          </p>
        </div>
        <select
          className="h-[38px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
          value={windowId}
          onChange={(e) => setWindowId(e.target.value)}
        >
          {windows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </div>

      {data && (
        <div className="grid grid-cols-4 gap-[var(--space-4)]">
          {[
            { value: data.stats.sittings, label: "Sittings" },
            { value: data.stats.withFlags, label: "With flags" },
            { value: data.stats.awaitingReview, label: "Awaiting review" },
            { value: data.stats.referred, label: "Referred" },
          ].map((s) => (
            <Card key={s.label} elev="sm" className="px-5 py-4 gap-0">
              <div className="font-heading font-bold text-[21px]">{s.value}</div>
              <div className="text-neutral-500 text-[11px] tracking-[0.06em] uppercase mt-0.5">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-[var(--space-5)] items-start">
        <Card elev="sm" className="px-4 py-2 gap-0 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-neutral-500 border-b border-divider">
                <th className="py-2.5 font-semibold">Candidate</th>
                <th className="py-2.5 font-semibold">Sat</th>
                <th className="py-2.5 font-semibold">Flags</th>
                <th className="py-2.5 font-semibold">Review</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r: SittingRow) => (
                <tr
                  key={r.sittingId}
                  onClick={() => setSelectedId(r.sittingId)}
                  className={`cursor-pointer border-b border-dashed border-neutral-300 ${r.sittingId === selectedId ? "bg-accent-100" : ""}`}
                >
                  <td className="py-2.5">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-neutral-500 text-[11px]">{r.candidateNumber}</div>
                  </td>
                  <td className="py-2.5 text-neutral-600 text-[12.5px] whitespace-nowrap">{fmtDateTime(r.sat)}</td>
                  <td className="py-2.5">
                    <Tag variant={flagTag(r.flagCount).variant} className="text-[10px] tabular-nums">
                      {r.flagCount}
                    </Tag>
                  </td>
                  <td className="py-2.5">
                    <Tag variant={REVIEW_TAG[r.conductReview].variant} className="text-[10.5px]">
                      {REVIEW_TAG[r.conductReview].label}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {detail && (
          <Card elev="sm" className="p-5 gap-0">
            <div className="flex justify-between items-start gap-3">
              <div>
                <CardKicker>Sitting record</CardKicker>
                <div className="font-heading font-semibold text-[16px] mt-0.5">{detail.name}</div>
                <div className="text-neutral-500 text-[12px] mt-0.5">{detail.candidateNumber}</div>
              </div>
              <Tag variant={REVIEW_TAG[detail.conductReview].variant} className="font-semibold">
                {REVIEW_TAG[detail.conductReview].label}
              </Tag>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                { label: "Duration used", value: detail.durationUsedMinutes != null ? `${detail.durationUsedMinutes} min` : "—" },
                { label: "Submitted", value: fmtDateTime(detail.submittedAt) },
                { label: "Score", value: detail.score != null ? `${detail.score}%` : "Pending" },
                { label: "Flags", value: String(detail.flagTotal) },
              ].map((f) => (
                <div key={f.label} className="p-3 rounded-md bg-neutral-100">
                  <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">{f.label}</div>
                  <div className="text-[13px] font-medium mt-0.5">{f.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-dashed border-neutral-300">
              <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Event timeline</div>
              <div className="flex flex-col mt-2.5">
                {detail.events.map((ev) => (
                  <div key={ev.id} className="flex gap-3 py-2 border-b border-dashed border-neutral-300">
                    <span className="flex-none w-[54px] text-neutral-500 text-[11.5px] tabular-nums">{fmtDateTime(ev.at)}</span>
                    <span className="flex-none w-[7px] h-[7px] mt-1.5 rounded-full bg-accent-2" />
                    <div className="flex-1 min-w-0 text-[12.5px] font-medium">{ev.label}</div>
                  </div>
                ))}
                {detail.events.length === 0 && (
                  <div className="py-6 text-center">
                    <div className="font-heading font-semibold text-[13.5px]">No conduct events</div>
                    <div className="text-neutral-500 text-[12px] mt-0.5">This paper was sat without a single flag.</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Label>Invigilator finding</Label>
              <Textarea
                rows={3}
                value={finding}
                onChange={(e) => setFinding(e.target.value)}
                placeholder="What did you observe, and does it warrant action?"
              />
            </div>

            {error && <div className="text-[12px] text-[#b42318] mt-2">{error}</div>}

            <div className="flex flex-col gap-2 mt-3">
              <Button variant="primary" disabled={busy || !finding.trim()} onClick={() => act("clear")}>
                {detail.conductReview === "CLEARED" ? "Cleared ✓" : "Clear this sitting"}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !finding.trim()}
                onClick={() => act("refer")}
                className="border-[#e8b4ae] text-[#b42318]"
              >
                Refer to the examinations panel
              </Button>
            </div>
            <div className="text-neutral-500 text-[11.5px] leading-snug mt-3">
              {detail.reviewedByStaffName
                ? `Reviewed by ${detail.reviewedByStaffName}${detail.referredAt ? " — referred, excluded from result release" : ""}.`
                : "Both actions become part of the candidate's permanent record."}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
