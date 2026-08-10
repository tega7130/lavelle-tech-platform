"use client";

import * as React from "react";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { approveReviewAction, declineReviewAction, unpublishReviewAction } from "@/app/actions/review";
import type { listReviewsForModeration } from "@/lib/review-reads";

type Data = Awaited<ReturnType<typeof listReviewsForModeration>>;
type ReviewItem = Data["pending"][number];

const STATE_TAG: Record<string, { label: string; variant: TagVariant | "success" | "warning" | "danger" }> = {
  PENDING: { label: "Awaiting review", variant: "neutral" },
  PUBLISHED: { label: "Published", variant: "success" },
  DECLINED: { label: "Declined", variant: "danger" },
};

export function ReviewModeration({ initial }: { initial: Data }) {
  const [data, setData] = React.useState(initial);
  const [tab, setTab] = React.useState<"pending" | "published" | "declined">("pending");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [declining, setDeclining] = React.useState<ReviewItem | null>(null);
  const [declineReason, setDeclineReason] = React.useState("");

  const items = data[tab];

  async function approve(id: string) {
    setBusyId(id);
    try {
      await approveReviewAction(id);
      setData((d) => ({
        ...d,
        pending: d.pending.filter((r) => r.id !== id),
        published: [{ ...d.pending.find((r) => r.id === id)!, state: "PUBLISHED", provenance: "Live since today" }, ...d.published],
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function unpublish(id: string) {
    setBusyId(id);
    try {
      await unpublishReviewAction(id);
      setData((d) => ({
        ...d,
        published: d.published.filter((r) => r.id !== id),
        pending: [{ ...d.published.find((r) => r.id === id)!, state: "PENDING" }, ...d.pending],
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDecline() {
    if (!declining || !declineReason.trim()) return;
    setBusyId(declining.id);
    try {
      await declineReviewAction(declining.id, declineReason);
      setData((d) => ({
        ...d,
        pending: d.pending.filter((r) => r.id !== declining.id),
        declined: [{ ...declining, state: "DECLINED", declineReason }, ...d.declined],
      }));
      setDeclining(null);
      setDeclineReason("");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-[1000px] flex flex-col gap-[var(--space-5)]">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <CardKicker>Public site</CardKicker>
          <div className="font-heading font-semibold text-[17px] mt-0.5">Candidate reviews</div>
          <p className="text-neutral-600 text-[12.5px] leading-relaxed mt-1 max-w-[72ch]">
            Reviews are submitted by candidates who completed a programme. Nothing appears on the public site until it
            is approved here, and an approved review is never edited — if the wording is wrong, decline it and ask for
            another.
          </p>
        </div>
        <div className="text-neutral-500 text-[12px] text-right flex-none">
          {data.summary.publishedCount} published{data.summary.averageRating != null ? ` · ${data.summary.averageRating}★ average` : ""} ·{" "}
          {data.summary.awaitingCount} awaiting
        </div>
      </div>

      <Segmented
        name="revtab"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        options={[
          { value: "pending", label: `Awaiting review (${data.pending.length})` },
          { value: "published", label: `Published (${data.published.length})` },
          { value: "declined", label: `Declined (${data.declined.length})` },
        ]}
      />

      <div className="flex flex-col gap-[var(--space-4)]">
        {items.map((r) => (
          <Card key={r.id} elev="sm" className="p-5 gap-0">
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex-none w-[34px] h-[34px] rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-heading text-[12px] font-semibold">
                  {r.authorName
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="font-heading font-semibold text-[13.5px]">{r.authorName}</div>
                  <div className="text-neutral-500 text-[11.5px]">
                    {r.authorTitle}
                    {r.programmeTitle ? ` · ${r.programmeTitle}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 flex-none">
                <span className="text-[13px] tracking-[0.1em] text-accent-2-600">{"★".repeat(r.rating)}</span>
                <Tag variant={STATE_TAG[r.state].variant} className="text-[10.5px] font-semibold">
                  {STATE_TAG[r.state].label}
                </Tag>
              </div>
            </div>

            <p className="text-[13.5px] leading-relaxed mt-4 max-w-[72ch]">&ldquo;{r.quote}&rdquo;</p>

            <div className="flex justify-between items-center gap-4 flex-wrap mt-4 pt-4 border-t border-dashed border-neutral-300">
              <div className="text-neutral-500 text-[11.5px]">
                {r.state === "DECLINED" && r.declineReason ? `Declined — ${r.declineReason}` : r.provenance}
              </div>
              <div className="flex gap-2 flex-none">
                {r.state === "PENDING" && (
                  <>
                    <Button
                      variant="secondary"
                      className="h-[34px] text-[12.5px] border-[#e8b4ae] text-[#b42318]"
                      disabled={busyId === r.id}
                      onClick={() => setDeclining(r)}
                    >
                      Decline
                    </Button>
                    <Button variant="primary" className="h-[34px] text-[12.5px]" disabled={busyId === r.id} onClick={() => approve(r.id)}>
                      Approve and publish
                    </Button>
                  </>
                )}
                {r.state === "PUBLISHED" && (
                  <Button variant="secondary" className="h-[34px] text-[12.5px]" disabled={busyId === r.id} onClick={() => unpublish(r.id)}>
                    Unpublish
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}

        {items.length === 0 && (
          <Card elev="sm" className="p-8 text-center">
            <div className="font-heading font-semibold text-[14px]">
              {tab === "pending" ? "Nothing waiting" : tab === "published" ? "Nothing published yet" : "Nothing declined"}
            </div>
            <div className="text-neutral-500 text-[12.5px] mt-1">
              {tab === "pending" ? "Reviews appear here as candidates submit them." : "Reviews will appear here once moderated."}
            </div>
          </Card>
        )}
      </div>

      <Dialog
        open={!!declining}
        onClose={() => setDeclining(null)}
        title="Decline this review?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!declineReason.trim() || busyId === declining?.id} onClick={confirmDecline}>
              Decline review
            </Button>
          </>
        }
      >
        <div className="mb-2">This reason is internal only — the candidate is never told their review was declined.</div>
        <Textarea rows={3} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Why is this being declined?" />
      </Dialog>
    </div>
  );
}
