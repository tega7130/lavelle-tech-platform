"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { submitSittingAction, forfeitSittingAction, expireSittingIfOverdueAction } from "@/app/actions/exam-sitting";
import type { getSittingForCandidate } from "@/lib/exam-candidate-reads";

type SittingData = Awaited<ReturnType<typeof getSittingForCandidate>>;

interface AnswerState {
  selectedOptionId: string | null;
  writtenAnswer: string | null;
  flagged: boolean;
}

function formatClock(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ExamSitting({ data }: { data: SittingData }) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<string, AnswerState>>(data.answers);
  const [index, setIndexRaw] = React.useState(0);
  const canReview = data.exam.allowReviewBeforeSubmit;
  const maxIndexReached = React.useRef(0);
  function setIndex(next: number | ((prev: number) => number)) {
    setIndexRaw((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      // Review disabled: once you move past a question, it's behind you —
      // no jumping back to change an earlier answer.
      if (!canReview && resolved < prev) return prev;
      maxIndexReached.current = Math.max(maxIndexReached.current, resolved);
      return resolved;
    });
  }
  const [now, setNow] = React.useState(() => Date.now());
  const [fullscreenOk, setFullscreenOk] = React.useState(!data.exam.enforceFullScreen);
  const [tabWarning, setTabWarning] = React.useState<string | null>(null);
  const [quitOpen, setQuitOpen] = React.useState(false);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  // Mobile-only bottom drawer for the question navigator — desktop keeps it
  // as a permanently visible right-hand column (see the `md:` split below).
  const [navigatorOpen, setNavigatorOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [expiring, setExpiring] = React.useState(false);
  // expiresAt is only ever null before startSitting has run — the page
  // guards on state === "IN_PROGRESS" before rendering this, so it is
  // always set here in practice.
  const expiresAtMs = data.sitting.expiresAt ? new Date(data.sitting.expiresAt).getTime() : Date.now();
  const saveTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const paper = data.paper;
  const question = paper[index];
  const answeredCount = Object.values(answers).filter((a) => a.selectedOptionId || (a.writtenAnswer && a.writtenAnswer.trim())).length;

  // The server clock, not the client's, is authoritative — this tick is
  // purely cosmetic; expireSittingIfOverdueAction re-checks server-side.
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = expiresAtMs - now;
  React.useEffect(() => {
    if (remaining > 0 || expiring) return;
    setExpiring(true);
    expireSittingIfOverdueAction(data.sitting.id).finally(() => {
      router.push(`/portal/exams/${data.programme.code}`);
      router.refresh();
    });
  }, [remaining, expiring, data.sitting.id, data.programme.code, router]);

  React.useEffect(() => {
    if (!data.exam.enforceFullScreen) return;
    function onFsChange() {
      const inFs = !!document.fullscreenElement;
      setFullscreenOk(inFs);
      if (!inFs) {
        void fetch("/api/sitting/proctoring", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sittingId: data.sitting.id, kind: "fullscreen_exit" }),
        });
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [data.exam.enforceFullScreen, data.sitting.id]);

  React.useEffect(() => {
    if (!data.exam.warnOnTabSwitch) return;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        void fetch("/api/sitting/proctoring", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sittingId: data.sitting.id, kind: "tab_switch" }),
        });
      } else {
        setTabWarning("Switching away from the paper is logged.");
        setTimeout(() => setTabWarning(null), 4000);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [data.exam.warnOnTabSwitch, data.sitting.id]);

  function scheduleSave(questionId: string, next: AnswerState) {
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      void fetch("/api/sitting/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sittingId: data.sitting.id, questionId, ...next }),
      });
    }, 500);
  }

  function setAnswer(questionId: string, patch: Partial<AnswerState>) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? { selectedOptionId: null, writtenAnswer: null, flagged: false };
      const next = { ...current, ...patch };
      scheduleSave(questionId, next);
      return { ...prev, [questionId]: next };
    });
  }

  async function requestFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Best-effort — some browsers/contexts refuse; the candidate can still proceed.
    }
    setFullscreenOk(true);
  }

  async function confirmSubmit() {
    setBusy(true);
    try {
      await submitSittingAction(data.sitting.id);
      router.push(`/portal/exams/${data.programme.code}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmQuit() {
    setBusy(true);
    try {
      await forfeitSittingAction(data.sitting.id);
      router.push(`/portal/exams/${data.programme.code}`);
    } finally {
      setBusy(false);
    }
  }

  // Shared between the permanent desktop column and the mobile bottom
  // drawer — onSelect additionally dismisses the drawer, wired up only for
  // the mobile variant, after jumping to the chosen question.
  function renderQuestionNavigator(onSelect?: () => void) {
    return (
      <div className="grid grid-cols-5 gap-1.5">
        {paper.map((q, i) => {
          const a = answers[q.questionId];
          const done = a?.selectedOptionId || (a?.writtenAnswer && a.writtenAnswer.trim());
          const locked = !canReview && i < index;
          return (
            <button
              key={q.questionId}
              onClick={() => {
                setIndex(i);
                onSelect?.();
              }}
              disabled={locked}
              title={locked ? "Review before submission is switched off for this examination" : undefined}
              className="h-8 rounded-md text-[11px] font-medium relative disabled:cursor-not-allowed"
              style={{
                border: i === index ? "2px solid var(--color-accent)" : "1px solid var(--color-neutral-300)",
                background: done ? "var(--color-accent-2-100)" : "transparent",
                opacity: locked ? 0.45 : 1,
              }}
            >
              {i + 1}
              {a?.flagged && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#c77d0a]" />}
            </button>
          );
        })}
      </div>
    );
  }

  if (data.exam.enforceFullScreen && !fullscreenOk) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-[420px] text-center">
          <div className="font-heading font-semibold text-[17px]">This examination requires full screen</div>
          <p className="text-neutral-600 text-[13px] mt-2">Leaving full screen during the sitting is logged. Enter full screen to begin.</p>
          <Button className="mt-5" onClick={requestFullscreen}>
            Enter full screen and begin
          </Button>
        </div>
      </div>
    );
  }

  const current = answers[question?.questionId ?? ""] ?? { selectedOptionId: null, writtenAnswer: null, flagged: false };
  const wordCount = current.writtenAnswer ? current.writtenAnswer.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-3.5 border-b border-divider bg-bg">
        <div className="min-w-0">
          <div className="font-heading font-semibold text-[13.5px] truncate">{data.programme.title} — Examination</div>
          <div className="text-neutral-500 text-[11px] mt-0.5 whitespace-nowrap">
            Question {index + 1} of {paper.length} · {answeredCount} answered
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 flex-none">
          <div
            className="font-heading font-bold text-base sm:text-lg tabular-nums px-2 sm:px-3 py-1 rounded-md"
            style={{ color: remaining < 5 * 60 * 1000 ? "#b42318" : "inherit", background: remaining < 5 * 60 * 1000 ? "#fef3f2" : "transparent" }}
          >
            {formatClock(remaining)}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="secondary"
              className="md:hidden h-9 px-3 text-xs"
              onClick={() => setNavigatorOpen(true)}
            >
              Questions
            </Button>
            <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => setQuitOpen(true)}>
              Quit
            </Button>
            <Button className="h-9 px-4 text-xs" onClick={() => setSubmitOpen(true)}>
              Submit
            </Button>
          </div>
        </div>
      </div>

      {tabWarning && (
        <div className="px-6 py-2 bg-[#fff7e6] border-b border-[#f0d9a8] text-[#8a6013] text-[12px] text-center">{tabWarning}</div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-[720px] mx-auto">
            {question && (
              <div key={question.questionId}>
                <div className="flex items-center justify-between gap-3">
                  <Tag variant="neutral">{question.type === "OBJECTIVE" ? "Multiple choice" : "Written answer"}</Tag>
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-500 text-[11.5px]">{question.marks} marks</span>
                    {canReview && (
                    <label className="flex items-center gap-1.5 text-[11.5px] text-neutral-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={current.flagged}
                        onChange={(e) => setAnswer(question.questionId, { flagged: e.target.checked })}
                        className="w-3.5 h-3.5 accent-accent"
                      />
                      Flag for review
                    </label>
                    )}
                  </div>
                </div>

                <div className="font-heading text-[18px] leading-relaxed mt-4">{question.prompt}</div>

                {question.type === "WRITTEN" && (
                  <>
                    {question.guidance && <p className="text-neutral-600 text-[12.5px] mt-2 leading-relaxed">{question.guidance}</p>}
                    <textarea
                      rows={14}
                      value={current.writtenAnswer ?? ""}
                      onChange={(e) => setAnswer(question.questionId, { writtenAnswer: e.target.value })}
                      className="w-full mt-4 border border-neutral-300 rounded-md p-4 text-[13.5px] leading-relaxed resize-y font-body"
                      placeholder="Write your answer here."
                    />
                    <div className="text-neutral-500 text-[11px] mt-1.5 text-right tabular-nums">
                      {wordCount} words{question.wordLimit ? ` · guide ${question.wordLimit}` : ""}
                    </div>
                  </>
                )}

                {question.type === "OBJECTIVE" && (
                  <div className="flex flex-col gap-2.5 mt-5">
                    {question.options?.map((o) => (
                      <label
                        key={o.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-md border cursor-pointer"
                        style={{
                          borderColor: current.selectedOptionId === o.id ? "var(--color-accent)" : "var(--color-neutral-300)",
                          background: current.selectedOptionId === o.id ? "var(--color-accent-100)" : "transparent",
                        }}
                      >
                        <input
                          type="radio"
                          name={question.questionId}
                          checked={current.selectedOptionId === o.id}
                          onChange={() => setAnswer(question.questionId, { selectedOptionId: o.id })}
                          className="w-4 h-4 accent-accent"
                        />
                        <span className="text-[13.5px]">{o.text}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between mt-8">
              <Button variant="secondary" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || !canReview}>
                Previous
              </Button>
              <Button onClick={() => setIndex((i) => Math.min(paper.length - 1, i + 1))} disabled={index === paper.length - 1}>
                Next
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden md:block w-[220px] flex-none border-l border-divider bg-bg p-4 overflow-y-auto">
          {renderQuestionNavigator()}
        </div>
      </div>

      {navigatorOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex md:hidden items-end bg-[rgba(19,26,46,0.45)]" onClick={() => setNavigatorOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-h-[70vh] rounded-t-lg bg-bg border-t border-divider p-4 pb-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Questions</div>
                <button
                  onClick={() => setNavigatorOpen(false)}
                  aria-label="Close"
                  className="w-7 h-7 rounded-md border border-divider bg-bg text-neutral-600 flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
                >
                  ×
                </button>
              </div>
              {renderQuestionNavigator(() => setNavigatorOpen(false))}
            </div>
          </div>,
          document.body
        )}

      <Dialog open={quitOpen} onClose={() => setQuitOpen(false)} title="Quit this sitting?">
        <p>
          Nothing you have answered will be marked, no result will be recorded, and this registration is closed. You would need to register again,
          including paying the fee again, for a further attempt.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setQuitOpen(false)}>
            Stay in the sitting
          </Button>
          <Button variant="danger" disabled={busy} onClick={confirmQuit}>
            Quit and forfeit
          </Button>
        </div>
      </Dialog>

      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit your paper?">
        <p>
          {answeredCount} of {paper.length} question{paper.length === 1 ? "" : "s"} answered
          {answeredCount < paper.length ? ` — ${paper.length - answeredCount} left blank` : ""}. Once submitted you cannot change any answer.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setSubmitOpen(false)}>
            Keep working
          </Button>
          <Button disabled={busy} onClick={confirmSubmit}>
            Submit final answers
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
