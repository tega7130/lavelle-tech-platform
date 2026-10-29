"use client";

import * as React from "react";
import Link from "next/link";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import {
  approveLawyerWebsiteVerificationAction,
  rejectLawyerWebsiteVerificationAction,
} from "@/app/actions/lawyer-website-admin";
import type { listLawyerWebsiteVerificationQueue, listLawyerWebsiteVerificationHistory } from "@/lib/lawyer-website-reads";

type PendingItem = Awaited<ReturnType<typeof listLawyerWebsiteVerificationQueue>>[number];
type HistoryItem = Awaited<ReturnType<typeof listLawyerWebsiteVerificationHistory>>[number];

const CONTENT_CHECKLIST = [
  "No client names or confidential matter details",
  "No fee, pricing, or discount advertising",
  "No comparative or self-aggrandising claims, and no implied formal \"specialist\" certification",
];

export function LawyerWebsiteModeration({
  initial,
}: {
  initial: { pending: PendingItem[]; approved: HistoryItem[]; rejected: HistoryItem[] };
}) {
  const [data, setData] = React.useState(initial);
  const [tab, setTab] = React.useState<"pending" | "approved" | "rejected">("pending");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = React.useState<PendingItem | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  async function approve(item: PendingItem) {
    setBusyId(item.verificationId);
    try {
      await approveLawyerWebsiteVerificationAction(item.verificationId);
      setData((d) => ({ ...d, pending: d.pending.filter((p) => p.verificationId !== item.verificationId) }));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting || rejectReason.trim().length < 10) return;
    setBusyId(rejecting.verificationId);
    try {
      await rejectLawyerWebsiteVerificationAction(rejecting.verificationId, rejectReason);
      setData((d) => ({ ...d, pending: d.pending.filter((p) => p.verificationId !== rejecting.verificationId) }));
      setRejecting(null);
      setRejectReason("");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-[1000px] flex flex-col gap-[var(--space-5)]">
      <div>
        <CardKicker>Lawyer Website Builder</CardKicker>
        <div className="font-heading font-semibold text-[17px] mt-0.5">Identity & compliance review</div>
        <p className="text-neutral-600 text-[12.5px] leading-relaxed mt-1 max-w-[72ch]">
          Nothing goes live until the lawyer&apos;s identity is verified here. Check the evidence against their chosen
          entity type, and skim the draft site itself against the checklist below before approving — both matter,
          not identity alone.
        </p>
      </div>

      <Segmented
        name="lwtab"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        options={[
          { value: "pending", label: `Awaiting review (${data.pending.length})` },
          { value: "approved", label: `Approved (${data.approved.length})` },
          { value: "rejected", label: `Rejected (${data.rejected.length})` },
        ]}
      />

      {tab === "pending" && (
        <div className="flex flex-col gap-[var(--space-4)]">
          {data.pending.map((item) => (
            <Card key={item.verificationId} elev="sm" className="p-5 gap-0">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                  <div className="font-heading font-semibold text-[13.5px]">
                    {item.candidateName}
                    {item.entityType === "LAW_FIRM" && item.firmName ? ` — ${item.firmName}` : ""}
                  </div>
                  <div className="text-neutral-500 text-[11.5px]">{item.candidateEmail}</div>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  {item.isWaitingToPublish && <Tag variant="warning">Waiting to publish</Tag>}
                  <Tag variant={item.entityType === "LAW_FIRM" ? "accent-2" : "accent"}>{item.entityType === "LAW_FIRM" ? "Law firm" : "Individual"}</Tag>
                </div>
              </div>

              <div className="mt-3 text-[13px] flex flex-col gap-1">
                {item.entityType === "LAW_FIRM" ? (
                  <div>CAC number: {item.cacNumber ?? <span className="text-neutral-400">not provided</span>}</div>
                ) : (
                  <div>SCN number: {item.scnNumber ?? <span className="text-neutral-400">not provided</span>}</div>
                )}
                <div className="flex gap-3">
                  {item.idCardEvidenceUrl && (
                    <a href={item.idCardEvidenceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      View ID card evidence
                    </a>
                  )}
                  {item.firmEvidenceUrl && (
                    <a href={item.firmEvidenceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      View firm evidence
                    </a>
                  )}
                  <Link href={`/admin/lawyer-websites/${item.lawyerWebsiteId}/preview`} target="_blank" className="text-accent hover:underline">
                    View draft site
                  </Link>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-dashed border-neutral-300">
                <ul className="text-[12px] text-neutral-600 list-disc pl-4 mb-2">
                  {CONTENT_CHECKLIST.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <label className="flex items-start gap-[8px] text-[12.5px] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-[3px] accent-accent"
                    checked={!!checked[item.verificationId]}
                    onChange={(e) => setChecked((c) => ({ ...c, [item.verificationId]: e.target.checked }))}
                  />
                  <span>I&apos;ve checked the draft site against the above.</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="secondary"
                  className="h-[34px] text-[12.5px] border-[#e8b4ae] text-[#b42318]"
                  disabled={busyId === item.verificationId}
                  onClick={() => setRejecting(item)}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  className="h-[34px] text-[12.5px]"
                  disabled={!checked[item.verificationId] || busyId === item.verificationId}
                  onClick={() => approve(item)}
                >
                  Approve
                </Button>
              </div>
            </Card>
          ))}
          {data.pending.length === 0 && (
            <Card elev="sm" className="p-8 text-center">
              <div className="font-heading font-semibold text-[14px]">Nothing waiting</div>
              <div className="text-neutral-500 text-[12.5px] mt-1">Requests appear here as lawyers submit their verification evidence.</div>
            </Card>
          )}
        </div>
      )}

      {(tab === "approved" || tab === "rejected") && (
        <div className="flex flex-col gap-[var(--space-3)]">
          {data[tab].map((item) => (
            <Card key={item.verificationId} elev="sm" className="p-4">
              <div className="font-heading font-semibold text-[13px]">{item.candidateName}</div>
              <div className="text-neutral-500 text-[11.5px]">{item.candidateEmail}</div>
              {item.rejectionReason && <div className="text-[12.5px] text-[#b42318] mt-1">Reason: {item.rejectionReason}</div>}
            </Card>
          ))}
          {data[tab].length === 0 && (
            <Card elev="sm" className="p-8 text-center">
              <div className="font-heading font-semibold text-[14px]">Nothing here yet</div>
            </Card>
          )}
        </div>
      )}

      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this verification?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={rejectReason.trim().length < 10 || busyId === rejecting?.verificationId} onClick={confirmReject}>
              Reject
            </Button>
          </>
        }
      >
        <div className="mb-2">This reason is shown to the candidate so they know what to fix before resubmitting.</div>
        <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this being rejected?" />
      </Dialog>
    </div>
  );
}
