"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button, buttonClassName } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { Input } from "@/components/ui/field";
import { LogoMark } from "@/components/ui/logo-mark";
import { tierLabel } from "@/lib/format";
import { getCandidateQuickViewAction } from "@/app/actions/candidate-admin";
import { reissueIdCard } from "@/app/actions/payment";
import { TransferIntakeModal } from "@/components/admin/transfer-intake-modal";

type QuickView = Awaited<ReturnType<typeof getCandidateQuickViewAction>>;

function relativeTime(d: Date) {
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CandidateQuickViewModal({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  const [data, setData] = React.useState<QuickView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showTransfer, setShowTransfer] = React.useState(false);
  const [showIdCard, setShowIdCard] = React.useState(false);
  const [showReissue, setShowReissue] = React.useState(false);
  const [reissueReason, setReissueReason] = React.useState("");
  const [reissuing, setReissuing] = React.useState(false);
  const [reissueError, setReissueError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    getCandidateQuickViewAction(candidateId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this candidate."));
  }, [candidateId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function submitReissue() {
    if (!reissueReason.trim()) return;
    setReissuing(true);
    setReissueError(null);
    try {
      await reissueIdCard(candidateId, reissueReason.trim());
      setShowReissue(false);
      setReissueReason("");
      load();
    } catch (e) {
      setReissueError(e instanceof Error ? e.message : "Could not reissue the card.");
    } finally {
      setReissuing(false);
    }
  }

  if (showTransfer && data?.primaryEnrolment) {
    return (
      <TransferIntakeModal
        enrolmentId={data.primaryEnrolment.id}
        candidateName={`${data.candidate.firstName} ${data.candidate.lastName}`}
        candidateNumber={data.candidate.candidateNumber}
        currentIntakeLabel={data.primaryEnrolment.intakeLabel}
        onClose={() => setShowTransfer(false)}
        onTransferred={() => {
          setShowTransfer(false);
          load();
        }}
      />
    );
  }

  return (
    <Dialog open onClose={onClose} className="w-[min(560px,100%)] max-h-[calc(100vh-64px)] overflow-y-auto">
      {error && <div className="text-[13px] text-[#b42318]">{error}</div>}
      {!data && !error && <div className="text-[13px] text-neutral-500 py-6 text-center">Loading…</div>}

      {data && (
        <>
          <div className="flex items-center gap-3 -mt-1">
            <div className="w-11 h-11 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-[14px] font-heading font-semibold flex-none">
              {data.candidate.firstName[0]}
              {data.candidate.lastName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-heading font-bold text-lg">
                {data.candidate.firstName} {data.candidate.lastName}
              </div>
              <div className="text-neutral-500 text-[12px]">
                {data.candidate.candidateNumber ?? data.candidate.applicantNumber}
                {data.primaryEnrolment ? ` · ${data.primaryEnrolment.programmeTitle}` : ""}
              </div>
            </div>
            <Tag variant={data.candidate.accountStatus === "SUSPENDED" ? "danger" : "success"}>
              {data.candidate.accountStatus === "SUSPENDED" ? "Suspended" : "Active"}
            </Tag>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-4">
            <div className="rounded-md bg-neutral-100 p-3 text-center">
              <div className="font-heading font-bold text-xl tabular-nums">{data.stats.percent != null ? `${data.stats.percent}%` : "—"}</div>
              <div className="text-neutral-500 text-[10px] tracking-[0.05em] uppercase mt-0.5">Progress</div>
            </div>
            <div className="rounded-md bg-neutral-100 p-3 text-center">
              <div className="font-heading font-bold text-xl">{data.stats.averageGradeLabel ?? "—"}</div>
              <div className="text-neutral-500 text-[10px] tracking-[0.05em] uppercase mt-0.5">Average grade</div>
            </div>
            <div className="rounded-md bg-neutral-100 p-3 text-center">
              <div className="font-heading font-bold text-xl tabular-nums">
                {data.stats.completedLectures} of {data.stats.totalLectures}
              </div>
              <div className="text-neutral-500 text-[10px] tracking-[0.05em] uppercase mt-0.5">Submissions</div>
            </div>
          </div>

          <div className="mt-4 border-t border-dashed border-neutral-300 pt-3 flex flex-col">
            {data.timeline.length === 0 && <div className="text-[12.5px] text-neutral-500 py-3">No activity recorded yet.</div>}
            {data.timeline.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-neutral-300 last:border-b-0">
                <div className="text-[12.5px] min-w-0">{t.description}</div>
                <div className="text-neutral-500 text-[11px] flex-none">{relativeTime(t.occurredAt)}</div>
              </div>
            ))}
          </div>

          {showIdCard && data.idCard && (
            <div className="mt-4 rounded-xl p-4 text-white" style={{ background: "#1668e3" }}>
              <div className="flex items-center gap-2">
                <LogoMark size={24} />
                <div className="font-heading font-semibold text-[12px]">Lavelle Institute</div>
              </div>
              <div className="font-heading font-bold text-[16px] text-accent-2 mt-3">
                {data.candidate.firstName} {data.candidate.lastName}
              </div>
              <div className="text-[11px] text-white/75 tabular-nums mt-0.5">{data.idCard.cardNumber}</div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-white/25 text-[10.5px] text-white/70">
                <span>{tierLabel(data.idCard.tier)}</span>
                <span>Valid to {new Date(data.idCard.validUntil).toLocaleDateString("en-GB")}</span>
              </div>
            </div>
          )}
          {showIdCard && !data.idCard && <div className="text-[12.5px] text-neutral-500 mt-3">No active ID card on file.</div>}

          {showReissue && (
            <div className="mt-4 p-3.5 rounded-md border border-divider">
              <div className="text-xs font-medium text-neutral-700 mb-1.5">Reason for reissue</div>
              <Input value={reissueReason} onChange={(e) => setReissueReason(e.target.value)} placeholder="Photo updated, card damaged, etc." dense />
              {reissueError && <div className="text-[12px] text-[#b42318] mt-1.5">{reissueError}</div>}
              <div className="flex justify-end gap-2 mt-2.5">
                <Button variant="secondary" onClick={() => setShowReissue(false)} disabled={reissuing} className="h-9 text-[12.5px]">
                  Cancel
                </Button>
                <Button onClick={submitReissue} disabled={!reissueReason.trim() || reissuing} className="h-9 text-[12.5px]">
                  {reissuing ? "Reissuing…" : "Confirm reissue"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {data.primaryEnrolment && (
              <Button variant="secondary" onClick={() => setShowTransfer(true)}>
                Transfer intake
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowReissue((v) => !v)}>
              Reissue card
            </Button>
            <Button onClick={() => setShowIdCard((v) => !v)}>{showIdCard ? "Hide ID card" : "View ID card"}</Button>
            <Link href={`/admin/candidates/${candidateId}`} className={buttonClassName("secondary")}>
              Full record →
            </Link>
          </div>
        </>
      )}
    </Dialog>
  );
}
