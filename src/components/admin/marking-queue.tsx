"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/segmented";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea, Input } from "@/components/ui/field";
import { AssessmentIcon } from "@/components/icons";
import {
  openMarkableAction,
  claimForMarkingAction,
  returnMarkAction,
  requestResubmissionAction,
} from "@/app/actions/marking";
import type { listMarkingQueue, openMarkable } from "@/lib/marking-reads";

type QueueItem = Awaited<ReturnType<typeof listMarkingQueue>>["items"][number];
type MarkDetail = Awaited<ReturnType<typeof openMarkable>>;

const STATE_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  AWAITING: "neutral",
  IN_REVIEW: "accent",
  RESUBMISSION_REQUESTED: "warning",
  RETURNED: "success",
};

function itemLabel(item: QueueItem) {
  if (item.isLate) return "Late";
  if (item.state === "RETURNED") return "Returned";
  if (item.state === "IN_REVIEW") return "Claimed";
  if (item.state === "RESUBMISSION_REQUESTED") return "Resubmission requested";
  return "Awaiting";
}

export function MarkingQueue({
  awaiting,
  returned,
  counts,
}: {
  awaiting: QueueItem[];
  returned: QueueItem[];
  counts: { awaiting: number; returned: number };
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"awaiting" | "returned">("awaiting");
  const items = tab === "awaiting" ? awaiting : returned;
  const [selectedId, setSelectedId] = React.useState<string | null>(items[0]?.id ?? null);
  const [detail, setDetail] = React.useState<MarkDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [scoreInput, setScoreInput] = React.useState("");
  const [feedbackInput, setFeedbackInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sentMessage, setSentMessage] = React.useState<string | null>(null);
  const [saveFailed, setSaveFailed] = React.useState(false);
  const [exportDenied, setExportDenied] = React.useState(false);
  const draftTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDetail = React.useCallback(async (markId: string) => {
    setLoadingDetail(true);
    setSentMessage(null);
    setSaveFailed(false);
    try {
      const d = await openMarkableAction(markId);
      setDetail(d);
      setScoreInput(d.scorePercent?.toString() ?? "");
      setFeedbackInput(d.feedback ?? "");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Debounced feedback/score autosave — a mark already RETURNED refuses
  // the write (the inputs are disabled by then anyway).
  const autosaveDraft = React.useCallback(async (markId: string, feedback: string, score: string) => {
    try {
      const res = await fetch("/api/marking/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markId,
          feedback,
          ...(score.trim() !== "" && Number.isFinite(Number(score)) ? { scorePercent: Number(score) } : {}),
        }),
      });
      setSaveFailed(!res.ok && res.status !== 409);
    } catch {
      setSaveFailed(true);
    }
  }, []);

  function onFeedbackChange(value: string) {
    setFeedbackInput(value);
    if (!selectedId) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => autosaveDraft(selectedId, value, scoreInput), 1200);
  }

  React.useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function selectTab(next: string) {
    setTab(next as "awaiting" | "returned");
    const list = next === "awaiting" ? awaiting : returned;
    setSelectedId(list[0]?.id ?? null);
  }

  async function claim() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await claimForMarkingAction(selectedId);
      await loadDetail(selectedId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const feedbackHint = feedbackInput.trim().length === 0 ? "Feedback is required before a grade can be returned." : "";

  async function returnGrade() {
    if (!selectedId) return;
    const score = Number(scoreInput);
    setBusy(true);
    try {
      await returnMarkAction(selectedId, { scorePercent: score, feedback: feedbackInput });
      setSentMessage("Returned to the candidate and recorded on their assessment record.");
      await loadDetail(selectedId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function requestResubmission() {
    if (!selectedId) return;
    const score = scoreInput.trim() ? Number(scoreInput) : undefined;
    setBusy(true);
    try {
      await requestResubmissionAction(selectedId, { scorePercent: score, feedback: feedbackInput });
      setSentMessage("Resubmission requested — the candidate has a new attempt and seven days.");
      await loadDetail(selectedId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setExportDenied(false);
    const res = await fetch("/api/exports/grades");
    if (res.status === 403) {
      setExportDenied(true);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grades-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[1400px]">
      <div className="flex justify-between items-center mb-[var(--space-4)]">
        <h1 className="font-heading text-2xl m-0">Marking queue</h1>
        <Button variant="secondary" onClick={exportCsv}>
          Export grades (CSV)
        </Button>
      </div>
      {exportDenied && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-md bg-[#fff7e6] border border-[#f0d9a8] mb-[var(--space-4)] text-[12.5px] text-[#8a6013]">
          <span className="font-bold">!</span>
          <div>
            <div className="font-semibold">You do not have permission to export grades</div>
            Grade exports are restricted to staff with the export permission. Your request has not been recorded.
            Ask an administrator to action it, or request the permission.
          </div>
        </div>
      )}
    <div className="grid gap-[var(--space-6)]" style={{ gridTemplateColumns: "340px minmax(0,1fr)" }}>
      <div>
        <Segmented
          name="mq"
          className="w-full mb-[var(--space-3)] [&>label]:flex-1 [&>label]:justify-center"
          value={tab}
          onChange={selectTab}
          options={[
            { value: "awaiting", label: `Awaiting (${counts.awaiting})` },
            { value: "returned", label: `Returned (${counts.returned})` },
          ]}
        />
        <div className="border border-divider rounded-md overflow-hidden">
          {items.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto mb-2.5">
                <AssessmentIcon width={17} height={17} />
              </div>
              {tab === "awaiting" ? (
                <>
                  <div className="font-heading font-semibold text-[14px]">The queue is clear</div>
                  <p className="text-neutral-600 text-[12.5px] mt-1.5">
                    Every drafting exercise and written examination answer has been marked and returned. New
                    submissions arrive here automatically.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-heading font-semibold text-[14px]">Nothing returned yet</div>
                  <p className="text-neutral-600 text-[12.5px] mt-1.5">Marks appear here once they&apos;ve been returned to a candidate.</p>
                </>
              )}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`p-[var(--space-4)] border-b border-dashed border-neutral-300 last:border-b-0 cursor-pointer ${
                  selectedId === item.id ? "bg-accent-100" : "hover:bg-neutral-100"
                }`}
              >
                <div className="flex justify-between gap-3">
                  <div className="text-[13.5px]">{item.candidateLabel}</div>
                  <Tag variant={STATE_TAG[item.state] as TagVariant}>{itemLabel(item)}</Tag>
                </div>
                <div className="text-neutral-500 text-[11.5px] mt-0.5">{item.source}</div>
                <div className="text-neutral-400 text-[11px] mt-0.5">{item.meta}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        {!detail || loadingDetail ? (
          <div className="text-neutral-500 text-[13px] py-8 text-center">
            {items.length === 0 ? "Select an item once one is in the queue." : "Loading…"}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start gap-[var(--space-4)]">
              <div>
                <h3 className="m-0">{detail.candidateLabel}</h3>
                <div className="text-neutral-500 text-[12.5px]">
                  {detail.submission?.moduleTitle} · {detail.submission?.lectureTitle}
                  {detail.candidateNumber ? ` · ${detail.candidateNumber}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                {detail.state === "AWAITING" && (
                  <Button variant="secondary" onClick={claim} disabled={busy}>
                    Claim
                  </Button>
                )}
                {detail.state !== "RETURNED" && (
                  <>
                    <Button variant="secondary" onClick={requestResubmission} disabled={busy || feedbackInput.trim().length === 0}>
                      Request resubmission
                    </Button>
                    <Button onClick={returnGrade} disabled={busy || feedbackInput.trim().length === 0 || scoreInput.trim() === ""}>
                      Return grade
                    </Button>
                  </>
                )}
              </div>
            </div>

            {detail.isLate && (
              <Tag variant="warning" className="mt-2">
                Late submission
              </Tag>
            )}

            <div className="border border-divider rounded-md p-[var(--space-4)] mt-[var(--space-4)]">
              <div className="text-[10px] tracking-[0.1em] uppercase text-accent font-semibold">Submitted response</div>
              <p className="text-[14px] leading-relaxed text-neutral-700 mt-2 whitespace-pre-line">{detail.submission?.body}</p>
              <div className="text-neutral-500 text-[11.5px] mt-2">
                {detail.submission?.wordCount} words
                {detail.submission?.wordLimit ? ` / ${detail.submission.wordLimit} limit` : ""} · attempt {detail.submission?.attemptNumber}
              </div>
            </div>

            {detail.submission?.prompt && (
              <div className="border border-divider rounded-md p-[var(--space-4)] mt-[var(--space-3)]">
                <div className="text-[10px] tracking-[0.1em] uppercase text-accent font-semibold">Prompt</div>
                <p className="text-[13px] text-neutral-700 mt-2">{detail.submission.prompt}</p>
              </div>
            )}

            {detail.priorAttempts.length > 0 && (
              <div className="border border-divider rounded-md p-[var(--space-4)] mt-[var(--space-3)]">
                <div className="text-[10px] tracking-[0.1em] uppercase text-accent font-semibold">Prior attempts</div>
                <div className="flex flex-col gap-2 mt-2">
                  {detail.priorAttempts.map((p) => (
                    <div key={p.id} className="text-[12.5px] border-b border-dashed border-neutral-300 pb-2 last:border-b-0 last:pb-0">
                      <div className="flex justify-between">
                        <span>Attempt {p.draftingSubmission?.attemptNumber}</span>
                        <span>
                          {p.scorePercent != null ? `${p.scorePercent}% — ${p.band}` : p.state.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </div>
                      {p.feedback && <p className="text-neutral-600 mt-1 mb-0">{p.feedback}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[1.3fr_1fr] gap-[var(--space-4)] mt-[var(--space-4)]">
              {detail.rubric && (
                <div className="border border-divider rounded-md p-[var(--space-4)]">
                  <div className="text-[10px] tracking-[0.1em] uppercase text-accent font-semibold">Rubric</div>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {detail.rubric.criteria.map((c) => (
                      <div key={c.id} className="flex justify-between text-[13px]">
                        <span>{c.label}</span>
                        <span className="text-neutral-500">/{c.maxMarks}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border border-divider rounded-md p-[var(--space-4)]">
                <div className="text-[10px] tracking-[0.1em] uppercase text-accent font-semibold">Grade</div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="Score %"
                  disabled={detail.state === "RETURNED"}
                  className="mt-2"
                />
                <div className="text-neutral-500 text-[11.5px] mt-2">Distinction 70 · Merit 60 · Pass 50</div>
              </div>
            </div>

            <div className="border border-divider rounded-md p-[var(--space-4)] mt-[var(--space-3)]">
              <div className="text-[10px] tracking-[0.1em] uppercase text-accent font-semibold">Feedback to candidate</div>
              <Textarea
                rows={4}
                value={feedbackInput}
                onChange={(e) => onFeedbackChange(e.target.value)}
                placeholder="Written feedback returned with the grade…"
                disabled={detail.state === "RETURNED"}
                className="mt-2"
              />
              {feedbackHint && detail.state !== "RETURNED" && <div className="text-neutral-500 text-[11.5px] mt-1.5">{feedbackHint}</div>}
              {saveFailed && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-md bg-[#fff7e6] border border-[#f0d9a8] mt-3 text-[12.5px] text-[#8a6013]">
                  <span className="font-bold">!</span>
                  <div>
                    <div className="font-semibold">This module could not be saved</div>
                    The connection dropped mid-save. Your changes are held locally and nothing has been lost. They
                    will be written when the connection returns, or you can retry now.
                  </div>
                  <Button
                    variant="secondary"
                    className="h-[31px] px-[11px] text-xs flex-none ml-auto"
                    onClick={() => selectedId && autosaveDraft(selectedId, feedbackInput, scoreInput)}
                  >
                    Retry save
                  </Button>
                </div>
              )}
              {sentMessage && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-md bg-[#e7f6ed] border border-[#bfe3cd] mt-3 text-[12.5px] text-[#116632]">
                  <span className="text-[#15803d] font-bold">✓</span>
                  {sentMessage}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </div>
  );
}
