"use client";

import * as React from "react";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/field";
import {
  assignExamStaffAction,
  unassignExamStaffAction,
  getExamSittingDetailAction,
  returnExamMarkAction,
} from "@/app/actions/exam-staff";
import { ROLE_LABELS } from "@/lib/permissions";
import type { listExamCandidates, getExamSittingDetail } from "@/lib/exam-reads";
import type { listExamStaffAssignments, listAssignableStaffForExam } from "@/lib/exam-staff";

type Candidates = Awaited<ReturnType<typeof listExamCandidates>>;
type Assignments = Awaited<ReturnType<typeof listExamStaffAssignments>>;
type Assignable = Awaited<ReturnType<typeof listAssignableStaffForExam>>;
type SittingDetail = Awaited<ReturnType<typeof getExamSittingDetail>>;

const SITTING_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  REGISTERED: "neutral",
  IN_PROGRESS: "warning",
  SUBMITTED: "warning",
  MARKED: "neutral",
  RELEASED: "success",
  FORFEITED: "danger",
  EXPIRED: "danger",
};

const CONDUCT_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  PENDING: "neutral",
  CLEARED: "success",
  REFERRED: "danger",
};

function formatDate(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ExamCandidates({
  examId,
  canManageStaff,
  candidates,
  assignments,
  assignable,
}: {
  examId: string;
  canManageStaff: boolean;
  candidates: Candidates;
  assignments: Assignments;
  assignable: Assignable;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      {canManageStaff && <AssignedStaffCard examId={examId} assignments={assignments} assignable={assignable} />}
      <RosterCard examId={examId} candidates={candidates} />
    </div>
  );
}

function AssignedStaffCard({ examId, assignments, assignable }: { examId: string; assignments: Assignments; assignable: Assignable }) {
  const [rows, setRows] = React.useState(assignments);
  const [options, setOptions] = React.useState(assignable);
  const [picked, setPicked] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add() {
    if (!picked) return;
    setBusy(true);
    try {
      await assignExamStaffAction(examId, picked);
      const staff = options.find((o) => o.id === picked)!;
      setRows((r) => [{ id: staff.id, staffId: staff.id, name: staff.name, email: staff.email, role: staff.role, assignedAt: new Date(), assignedByName: "You" }, ...r]);
      setOptions((o) => o.filter((x) => x.id !== picked));
      setPicked("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(staffId: string) {
    setBusy(true);
    try {
      await unassignExamStaffAction(examId, staffId);
      const removed = rows.find((r) => r.staffId === staffId);
      setRows((r) => r.filter((x) => x.staffId !== staffId));
      if (removed) setOptions((o) => [...o, { id: removed.staffId, name: removed.name, email: removed.email, role: removed.role }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card elev="sm">
      <CardKicker>Assigned staff</CardKicker>
      <p className="text-neutral-600 text-[12.5px] mt-1">
        Staff added here can see this exam&rsquo;s candidates, their answers, and grade written responses — without needing the platform-wide
        Manage examinations permission. Staff already holding that permission can already reach every exam and don&rsquo;t need to be added.
      </p>

      <div className="flex flex-col gap-2 mt-3">
        {rows.length === 0 && <div className="text-neutral-500 text-[12.5px]">No one has been assigned to this exam specifically.</div>}
        {rows.map((r) => (
          <div key={r.staffId} className="flex items-center gap-3 py-2 border-b border-dashed border-neutral-300 last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium">{r.name}</div>
              <div className="text-neutral-500 text-[11.5px]">
                {r.email} · {ROLE_LABELS[r.role]}
              </div>
            </div>
            <Button variant="secondary" className="h-[30px] px-[10px] text-xs border-[#e8b4ae] text-[#b42318]" disabled={busy} onClick={() => remove(r.staffId)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed border-neutral-300">
        <select
          className="flex-1 h-[38px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        >
          <option value="">Choose a staff member…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} — {ROLE_LABELS[o.role]}
            </option>
          ))}
        </select>
        <Button className="h-[38px] text-[12.5px]" disabled={!picked || busy} onClick={add}>
          Add
        </Button>
      </div>
    </Card>
  );
}

function RosterCard({ examId, candidates }: { examId: string; candidates: Candidates }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<SittingDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function openSitting(sittingId: string) {
    setOpenId(sittingId);
    setLoading(true);
    setDetail(null);
    try {
      setDetail(await getExamSittingDetailAction(sittingId, examId));
    } finally {
      setLoading(false);
    }
  }

  // Re-fetches rather than patching the mark into local state — the
  // server response from returnMark doesn't include the marker's name
  // (only their id), and refetching is the only way to show it without
  // a second round trip just for that.
  async function onGraded() {
    if (openId) setDetail(await getExamSittingDetailAction(openId, examId));
  }

  return (
    <div className="grid gap-[var(--space-5)] items-start" style={{ gridTemplateColumns: openId ? "1fr 1fr" : "1fr" }}>
      <Card elev="sm" className="p-0 overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <CardKicker>Registered candidates</CardKicker>
          <div className="text-neutral-500 text-[12px] mt-0.5">{candidates.length} registration{candidates.length === 1 ? "" : "s"}</div>
        </div>
        {candidates.length === 0 ? (
          <div className="px-5 py-10 text-center border-t border-dashed border-neutral-300">
            <div className="font-heading font-semibold text-[13.5px]">No one has registered yet</div>
          </div>
        ) : (
          <div className="border-t border-dashed border-neutral-300">
            {candidates.map((c) => (
              <div key={c.registrationId} className="flex flex-col gap-2 px-5 py-3 border-b border-dashed border-neutral-300 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{c.candidateName}</div>
                    <div className="text-neutral-500 text-[11.5px] tabular-nums">{c.candidateNumber}</div>
                  </div>
                  <Button
                    variant="secondary"
                    className="h-[30px] px-[10px] text-xs flex-none"
                    disabled={!c.sitting || c.sitting.state === "REGISTERED" || c.sitting.state === "IN_PROGRESS"}
                    onClick={() => c.sitting && openSitting(c.sitting.id)}
                  >
                    {c.sitting?.id === openId ? "Viewing" : "View answers"}
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11.5px] text-neutral-600">
                  <span>Window {formatDate(c.windowOpensAt)}</span>
                  <span>· Attempt {c.attemptNumber}</span>
                  <Tag variant="neutral">{c.pathway === "enrolled" ? "Enrolled" : "Exam-only"}</Tag>
                  {c.sitting ? <Tag variant={SITTING_TAG[c.sitting.state]}>{c.sitting.state.replace(/_/g, " ")}</Tag> : <Tag variant="neutral">Not started</Tag>}
                  {c.sitting?.totalPercent != null && <span className="tabular-nums">{c.sitting.totalPercent}%</span>}
                  {c.sitting && c.sitting.conductReview !== "PENDING" && (
                    <Tag variant={CONDUCT_TAG[c.sitting.conductReview]}>{c.sitting.conductReview}</Tag>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {openId && (
        <Card elev="sm">
          {loading || !detail ? (
            <div className="py-10 text-center text-neutral-500 text-[13px]">Loading…</div>
          ) : (
            <SittingDetailPanel examId={examId} detail={detail} onGraded={onGraded} onClose={() => setOpenId(null)} />
          )}
        </Card>
      )}
    </div>
  );
}

function SittingDetailPanel({
  examId,
  detail,
  onGraded,
  onClose,
}: {
  examId: string;
  detail: SittingDetail;
  onGraded: () => void;
  onClose: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardKicker>{detail.candidateName}</CardKicker>
          <div className="text-neutral-500 text-[11.5px] tabular-nums">{detail.candidateNumber}</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-neutral-500 text-[13px] cursor-pointer">
          ×
        </button>
      </div>

      <div className="flex gap-4 mt-3 pt-3 border-t border-dashed border-neutral-300 text-[12px]">
        <div>
          <span className="text-neutral-500">Objective</span> {detail.objectivePercent ?? "—"}%
        </div>
        <div>
          <span className="text-neutral-500">Written</span> {detail.writtenPercent ?? "—"}%
        </div>
        <div>
          <span className="text-neutral-500">Total</span> {detail.totalPercent ?? "—"}%
        </div>
        {detail.outcome && <Tag variant={detail.outcome === "PASS" ? "success" : "danger"}>{detail.outcome}</Tag>}
      </div>

      <div className="flex flex-col gap-3 mt-4">
        {detail.answers.map((a, i) => (
          <AnswerRow key={a.id} index={i + 1} examId={examId} answer={a} onGraded={onGraded} />
        ))}
      </div>
    </div>
  );
}

function AnswerRow({
  index,
  examId,
  answer,
  onGraded,
}: {
  index: number;
  examId: string;
  answer: SittingDetail["answers"][number];
  onGraded: () => void;
}) {
  const [score, setScore] = React.useState(answer.mark?.scorePercent != null ? String(answer.mark.scorePercent) : "");
  const [feedback, setFeedback] = React.useState(answer.mark?.feedback ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submitGrade() {
    if (!answer.mark) return;
    setBusy(true);
    setError(null);
    try {
      await returnExamMarkAction(answer.mark.id, examId, { scorePercent: Number(score), feedback });
      onGraded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this grade.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-divider p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-neutral-500 text-[11px] tabular-nums">Q{index}</span>
        <Tag variant="neutral">{answer.type === "OBJECTIVE" ? "Multiple choice" : "Written answer"}</Tag>
        <span className="text-neutral-500 text-[11px]">
          {answer.moduleTitle} · {answer.marks} marks
        </span>
        {answer.flagged && <Tag variant="warning">Flagged</Tag>}
      </div>
      <div className="text-[13px]">{answer.prompt}</div>

      {answer.type === "OBJECTIVE" ? (
        <div className="mt-2 text-[12.5px]">
          <div>
            <span className="text-neutral-500">Answered:</span> {answer.selectedOptionText ?? "No answer"}{" "}
            {answer.selectedOptionCorrect === true && <Tag variant="success">Correct</Tag>}
            {answer.selectedOptionCorrect === false && <Tag variant="danger">Incorrect</Tag>}
          </div>
          {answer.selectedOptionCorrect === false && (
            <div className="mt-1 text-neutral-500">Correct answer: {answer.correctOptionText}</div>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <div className="rounded-md bg-neutral-100 p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap">
            {answer.writtenAnswer || <span className="text-neutral-500">No answer submitted.</span>}
          </div>

          {answer.mark?.state === "RETURNED" ? (
            <div className="mt-2 text-[12.5px] text-neutral-600">
              <span className="font-medium text-text">
                {answer.mark.scorePercent}% — {answer.mark.band ?? "Ungraded"}
              </span>{" "}
              · marked by {answer.mark.markedByStaff?.name ?? "—"}
              {answer.mark.feedback && <div className="mt-1">{answer.mark.feedback}</div>}
            </div>
          ) : (
            <div className="mt-2.5 flex flex-col gap-2">
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <div>
                  <Label>Score (%)</Label>
                  <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
                </div>
                <div>
                  <Label>Feedback</Label>
                  <Textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                </div>
              </div>
              {error && <FieldError>{error}</FieldError>}
              <Button
                className="self-start h-[32px] text-xs"
                disabled={busy || score === "" || !feedback.trim()}
                onClick={submitGrade}
              >
                {busy ? "Saving…" : "Return mark"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
