"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { intakeLabel } from "@/lib/format";
import { listUpcomingIntakesAction, transferCandidateIntakeAction } from "@/app/actions/candidate-admin";

const MONTH_ORDER = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const MONTH_SHORT: Record<string, string> = {
  JANUARY: "Jan", FEBRUARY: "Feb", MARCH: "Mar", APRIL: "Apr", MAY: "May", JUNE: "Jun",
  JULY: "Jul", AUGUST: "Aug", SEPTEMBER: "Sep", OCTOBER: "Oct", NOVEMBER: "Nov", DECEMBER: "Dec",
};

export interface TransferIntakeModalProps {
  enrolmentId: string;
  candidateName: string;
  candidateNumber: string | null;
  currentIntakeLabel: string | null;
  onClose: () => void;
  onTransferred: (newLabel: string) => void;
}

export function TransferIntakeModal({ enrolmentId, candidateName, candidateNumber, currentIntakeLabel, onClose, onTransferred }: TransferIntakeModalProps) {
  const [intakes, setIntakes] = React.useState<Awaited<ReturnType<typeof listUpcomingIntakesAction>> | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    listUpcomingIntakesAction().then((rows) => {
      setIntakes(rows);
      if (rows.length > 0) setSelectedId(rows[0]!.id);
    });
  }, []);

  const selected = intakes?.find((i) => i.id === selectedId) ?? null;
  const selectedLabel = selected ? intakeLabel(selected.month, selected.year) : null;

  async function submit() {
    if (!selectedId) return;
    setPending(true);
    setError(null);
    try {
      const result = await transferCandidateIntakeAction(enrolmentId, selectedId);
      onTransferred(result.newLabel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not transfer this candidate.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Transfer intake" className="w-[min(520px,100%)] max-h-[calc(100vh-64px)] overflow-y-auto">
      <div className="text-[12.5px] text-neutral-600 -mt-2 mb-3">
        {candidateName} {candidateNumber ? `· ${candidateNumber}` : ""}
      </div>

      <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-neutral-100 mb-4 text-[12.5px]">
        <div>
          <div className="text-neutral-500 text-[10px] tracking-[0.08em] uppercase">Current cohort</div>
          <div className="font-medium mt-0.5">{currentIntakeLabel}</div>
        </div>
        <span className="text-neutral-400">→</span>
        <div className="text-right">
          <div className="text-neutral-500 text-[10px] tracking-[0.08em] uppercase">New cohort</div>
          <div className="font-medium mt-0.5 text-accent">{selectedLabel ?? "—"}</div>
        </div>
      </div>

      <div className="text-xs font-medium text-neutral-700 mb-1.5">Move to cohort</div>
      {!intakes ? (
        <div className="text-[12.5px] text-neutral-500 py-4">Loading intakes…</div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {MONTH_ORDER.map((month) => {
            const match = intakes.find((i) => i.month === month);
            const active = match?.id === selectedId;
            return (
              <button
                key={month}
                type="button"
                disabled={!match}
                onClick={() => match && setSelectedId(match.id)}
                className={`h-11 rounded-md text-[13px] font-medium border cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 disabled:bg-neutral-100 ${
                  active ? "border-accent bg-accent-100 text-accent-700" : "border-neutral-300 bg-bg text-text hover:bg-neutral-100"
                }`}
              >
                {MONTH_SHORT[month]}
              </button>
            );
          })}
        </div>
      )}
      <div className="text-[11px] text-neutral-500 mt-1.5">A scheduled intake — the candidate joins the existing cohort calendar.</div>

      <div className="flex items-start gap-2.5 p-3.5 rounded-md bg-[#fff7e6] border border-[#f0d9a8] mt-4">
        <span className="flex-none w-6 h-6 rounded-full bg-[#fdf0d2] text-[#a16207] flex items-center justify-center text-[13px] font-bold">!</span>
        <div className="text-xs text-[#8a6013] leading-relaxed">
          <div className="font-semibold mb-1">This will shift the candidate onto the new cohort calendar</div>
          <ul className="list-disc pl-4 flex flex-col gap-1">
            <li>Module progress carries over, but unlocked weeks are recalculated against the new cohort&rsquo;s release schedule.</li>
            <li>All outstanding drafting, quiz and examination deadlines move to the new cohort calendar; overdue items are cleared.</li>
            <li>Fees already settled transfer with the candidate.</li>
          </ul>
        </div>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer text-[12.5px] text-neutral-700 mt-3.5">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-[3px]" />
        <span>I have informed the candidate and confirm the transfer</span>
      </label>

      {error && <div className="text-[12.5px] text-[#b42318] mt-2">{error}</div>}

      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={!confirmed || !selectedId || pending}>
          {pending ? "Transferring…" : `Transfer to ${selectedLabel ?? "…"}`}
        </Button>
      </div>
    </Dialog>
  );
}
