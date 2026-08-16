"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Input, Textarea, Label } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { formatNaira } from "@/lib/format";
import {
  listExamBankAction,
  listExamWindowsAction,
  createExamQuestionAction,
  updateExamQuestionAction,
  retireExamQuestionAction,
  restoreExamQuestionAction,
  setExamRulesAction,
  publishExamAction,
} from "@/app/actions/exam-builder";
import { releaseResultsAction } from "@/app/actions/exam-sitting";
import type { listExamBank, listExamsForBuilder, listExamWindows } from "@/lib/exam-reads";

type Bank = Awaited<ReturnType<typeof listExamBank>>;
type ExamListItem = Awaited<ReturnType<typeof listExamsForBuilder>>[number];
type Question = Bank["modules"][number]["questions"][number];
type ExamWindow = Awaited<ReturnType<typeof listExamWindows>>[number];

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  IN_REVIEW: "warning",
  APPROVED: "success",
  RETIRED: "danger",
};

const ATTEMPT_LABEL: Record<string, string> = {
  ONE_ATTEMPT: "One attempt",
  TWO_ATTEMPTS: "Two attempts",
  ONE_RESIT_ON_REFERRAL: "One resit on referral",
};

interface QuestionFormState {
  mode: "create" | "edit";
  moduleId: string;
  id?: string;
  type: "OBJECTIVE" | "WRITTEN";
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "RETIRED";
  prompt: string;
  marks: string;
  examinerNote: string;
  guidance: string;
  wordLimit: string;
  options: { text: string; isCorrect: boolean }[];
}

function blankForm(moduleId: string): QuestionFormState {
  return {
    mode: "create",
    moduleId,
    type: "OBJECTIVE",
    status: "DRAFT",
    prompt: "",
    marks: "2",
    examinerNote: "",
    guidance: "",
    wordLimit: "300",
    options: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  };
}

function editForm(moduleId: string, q: Question): QuestionFormState {
  return {
    mode: "edit",
    moduleId,
    id: q.id,
    type: q.type as "OBJECTIVE" | "WRITTEN",
    status: q.status as QuestionFormState["status"],
    prompt: q.prompt,
    marks: String(q.marks),
    examinerNote: q.examinerNote ?? "",
    guidance: q.guidance ?? "",
    wordLimit: q.wordLimit != null ? String(q.wordLimit) : "300",
    options: q.options.length ? q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) : blankForm(moduleId).options,
  };
}

export function ExamBuilder({ exams, bank: initialBank }: { exams: ExamListItem[]; bank: Bank }) {
  const router = useRouter();
  const [bank, setBank] = React.useState(initialBank);
  const [openModules, setOpenModules] = React.useState<Set<string>>(new Set(bank.modules.filter((m) => m.shortfall).map((m) => m.id)));
  const [form, setForm] = React.useState<QuestionFormState | null>(null);
  const [retireTarget, setRetireTarget] = React.useState<{ moduleId: string; question: Question } | null>(null);
  const [retireReason, setRetireReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [rules, setRules] = React.useState({
    durationMinutes: bank.exam.durationMinutes,
    passMarkPercent: bank.exam.passMarkPercent,
    attemptPolicy: bank.exam.attemptPolicy,
    feeMinor: bank.exam.feeMinor,
    enforceFullScreen: bank.exam.enforceFullScreen,
    warnOnTabSwitch: bank.exam.warnOnTabSwitch,
    shuffleQuestions: bank.exam.shuffleQuestions,
    shuffleOptions: bank.exam.shuffleOptions,
    allowReviewBeforeSubmit: bank.exam.allowReviewBeforeSubmit,
  });

  const [windows, setWindows] = React.useState<ExamWindow[]>([]);
  const [releasingId, setReleasingId] = React.useState<string | null>(null);
  const [capacityValue, setCapacityValue] = React.useState("");
  const [uncapped, setUncapped] = React.useState(true);
  const capacitySeeded = React.useRef(false);

  async function refreshBank() {
    const fresh = await listExamBankAction(bank.exam.id);
    setBank(fresh);
  }

  React.useEffect(() => {
    listExamWindowsAction(bank.exam.id).then(setWindows);
  }, [bank.exam.id]);

  // Places available at this sitting (Slice 11 Part A) is a per-window
  // field, but the rules panel edits it for the ONE window this builder
  // is currently configuring — the soonest window still open for
  // registration, or the most recent one if none is upcoming.
  const currentWindow = React.useMemo(() => {
    const now = Date.now();
    const upcoming = windows.filter((w) => new Date(w.closesAt).getTime() >= now).sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime());
    return upcoming[0] ?? windows[0] ?? null;
  }, [windows]);

  React.useEffect(() => {
    if (currentWindow && !capacitySeeded.current) {
      capacitySeeded.current = true;
      setUncapped(currentWindow.capacity == null);
      setCapacityValue(currentWindow.capacity != null ? String(currentWindow.capacity) : "");
    }
  }, [currentWindow]);

  async function release(windowId: string) {
    setReleasingId(windowId);
    try {
      await releaseResultsAction(windowId);
      setWindows(await listExamWindowsAction(bank.exam.id));
    } finally {
      setReleasingId(null);
    }
  }

  function toggleModule(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitForm() {
    if (!form) return;
    setBusy(true);
    try {
      const options = form.type === "OBJECTIVE" ? form.options.filter((o) => o.text.trim()) : undefined;
      if (form.mode === "create") {
        await createExamQuestionAction(bank.exam.id, {
          moduleId: form.moduleId,
          type: form.type,
          status: form.status,
          prompt: form.prompt,
          marks: Number(form.marks),
          examinerNote: form.examinerNote || null,
          guidance: form.type === "WRITTEN" ? form.guidance || null : null,
          wordLimit: form.type === "WRITTEN" ? Number(form.wordLimit) : null,
          options,
        });
      } else if (form.id) {
        await updateExamQuestionAction(
          form.id,
          {
            status: form.status,
            prompt: form.prompt,
            marks: Number(form.marks),
            examinerNote: form.examinerNote || null,
            guidance: form.type === "WRITTEN" ? form.guidance || null : null,
            wordLimit: form.type === "WRITTEN" ? Number(form.wordLimit) : null,
            options,
          },
          bank.exam.id
        );
      }
      setForm(null);
      await refreshBank();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmRetire() {
    if (!retireTarget || !retireReason.trim()) return;
    setBusy(true);
    try {
      await retireExamQuestionAction(retireTarget.question.id, retireReason, bank.exam.id);
      setRetireTarget(null);
      setRetireReason("");
      await refreshBank();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function restore(q: Question) {
    setBusy(true);
    try {
      await restoreExamQuestionAction(q.id, bank.exam.id);
      await refreshBank();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveRules() {
    setBusy(true);
    try {
      const capacity = uncapped ? null : capacityValue.trim() ? Number(capacityValue) : null;
      await setExamRulesAction(bank.exam.id, { ...rules, capacityWindowId: currentWindow?.id ?? null, capacity });
      setWindows(await listExamWindowsAction(bank.exam.id));
      await refreshBank();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setPublishError(null);
    try {
      await publishExamAction(bank.exam.id);
      await refreshBank();
      router.refresh();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  // "Would retiring this question take the module below its draw?" —
  // computed from data already on the page, no extra round trip.
  function retireWarning(moduleId: string, q: Question): string | null {
    if (q.type !== "OBJECTIVE" || q.status !== "APPROVED") return null;
    const mod = bank.modules.find((m) => m.id === moduleId);
    if (!mod) return null;
    const approvedObjective = mod.questions.filter((x) => x.type === "OBJECTIVE" && x.status === "APPROVED").length;
    if (approvedObjective - 1 < mod.draw) {
      return `Retiring this leaves ${approvedObjective - 1} of ${mod.draw} objective questions approved for this module.`;
    }
    return null;
  }

  const summary = `${bank.exam.durationMinutes / 60} hour${bank.exam.durationMinutes === 60 ? "" : "s"}, ${bank.drawnTotal} question${bank.drawnTotal === 1 ? "" : "s"}, ${bank.exam.passMarkPercent}% to pass. ${bank.exam.enforceFullScreen ? "Full screen is required. " : ""}${bank.exam.warnOnTabSwitch ? "Switching tabs is logged. " : ""}${bank.exam.allowReviewBeforeSubmit ? "Answers may be reviewed before submitting." : "No review before submitting."}`;

  return (
    <div className="max-w-[1400px] flex flex-col gap-[var(--space-5)]">
      <div className="flex justify-between items-center gap-[var(--space-4)] flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="h-[38px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg min-w-[268px]"
            value={bank.exam.id}
            onChange={(e) => router.push(`/admin/exam-builder?examId=${e.target.value}`)}
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.programmeTitle} ({e.programmeCode})
              </option>
            ))}
          </select>
          <Tag variant={bank.exam.status === "PUBLISHED" ? "success" : "neutral"}>{bank.exam.status}</Tag>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.push(`/admin/exam-builder/${bank.exam.id}/candidates`)}>
            Candidates
          </Button>
          <Button onClick={publish} disabled={busy || bank.exam.status === "PUBLISHED"}>
            {bank.exam.status === "PUBLISHED" ? "Published" : "Publish exam"}
          </Button>
        </div>
      </div>

      {(bank.shortfalls.length > 0 || publishError) && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-md bg-[#fff7e6] border border-[#f0d9a8]">
          <span className="w-[26px] h-[26px] flex-none rounded-full bg-[#fdf0d2] text-[#a16207] flex items-center justify-center text-sm font-bold">!</span>
          <div>
            <div className="font-heading font-semibold text-[13.5px] text-[#7a4d06]">Question bank is short for the configured draw</div>
            <div className="text-[12.5px] text-[#8a6013] mt-0.5">
              {publishError ?? bank.shortfalls.map((s) => `${s.moduleTitle} — short by ${s.shortBy}`).join("; ")}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-[var(--space-5)] items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        <div className="flex flex-col gap-[var(--space-4)]">
          <Card elev="sm">
            <CardKicker>Question bank</CardKicker>
            <CardTitleRow bank={bank} />
          </Card>

          {form && (
            <QuestionFormCard
              form={form}
              setForm={setForm}
              onCancel={() => setForm(null)}
              onSubmit={submitForm}
              busy={busy}
              moduleOptions={bank.modules.map((m) => ({ id: m.id, title: m.title }))}
            />
          )}

          {bank.modules.map((mod) => {
            const open = openModules.has(mod.id);
            return (
              <Card key={mod.id} elev="sm" className="p-0 gap-0 overflow-hidden">
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="flex items-center gap-3 px-5 py-4 text-left w-full cursor-pointer"
                  style={{ background: mod.shortfall ? "#fffaf0" : "transparent" }}
                >
                  <span className="flex-1 min-w-0">
                    <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Week {mod.weekNumber}</div>
                    <div className="font-heading font-semibold text-[14px] mt-0.5">{mod.title}</div>
                  </span>
                  {mod.shortfall && (
                    <Tag variant="warning">Short by {mod.shortfall.shortBy} objective</Tag>
                  )}
                  <span className="text-neutral-500 text-[11.5px] flex-none">{mod.draw} drawn per attempt</span>
                  <Tag variant={mod.approvedCount === mod.totalCount ? "success" : "neutral"}>
                    {mod.approvedCount} / {mod.totalCount} approved
                  </Tag>
                </button>
                {open && (
                  <div className="border-t border-dashed border-neutral-300">
                    {mod.questions.length === 0 && (
                      <div className="px-5 py-8 text-center">
                        <div className="font-heading font-semibold text-[13.5px]">This module has no questions</div>
                        <p className="text-neutral-600 text-[12px] mt-1.5 max-w-[46ch] mx-auto">
                          It draws {mod.draw} objective question{mod.draw === 1 ? "" : "s"} per sitting, so it needs at least {mod.draw} approved
                          before the examination can be published.
                        </p>
                      </div>
                    )}
                    {mod.questions.map((q, i) => (
                      <div key={q.id} className="flex gap-3 px-5 py-4 border-b border-dashed border-neutral-300 last:border-b-0" style={{ background: q.status === "RETIRED" ? "var(--color-neutral-100)" : "transparent" }}>
                        <span className="text-neutral-500 text-[11.5px] w-5 flex-none tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                        <div className="flex-1 min-w-0">
                          <div
                            className="text-[13px] leading-relaxed"
                            style={{ color: q.status === "RETIRED" ? "var(--color-neutral-500)" : "inherit", textDecoration: q.status === "RETIRED" ? "line-through" : "none" }}
                          >
                            {q.prompt}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Tag variant="neutral">{q.type === "OBJECTIVE" ? "Multiple choice" : "Written answer"}</Tag>
                            <Tag variant={STATUS_TAG[q.status] as TagVariant}>{q.status.replace(/_/g, " ")}</Tag>
                            <span className="text-neutral-500 text-[11px]">
                              {q.marks} marks{q.status === "RETIRED" ? " · withdrawn from future draws" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-none">
                          {q.status !== "RETIRED" && (
                            <>
                              <Button variant="secondary" className="h-[30px] px-[10px] text-xs" onClick={() => setForm(editForm(mod.id, q))}>
                                Edit
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-[30px] px-[10px] text-xs border-[#e8b4ae] text-[#b42318]"
                                onClick={() => setRetireTarget({ moduleId: mod.id, question: q })}
                              >
                                Retire
                              </Button>
                            </>
                          )}
                          {q.status === "RETIRED" && (
                            <Button variant="secondary" className="h-[30px] px-[10px] text-xs" onClick={() => restore(q)} disabled={busy}>
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="px-5 py-3">
                      <button className="text-accent text-[12.5px] font-medium cursor-pointer" onClick={() => setForm(blankForm(mod.id))}>
                        + Add question to Week {mod.weekNumber}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-[var(--space-4)]">
          <Card elev="sm">
            <CardKicker>Examination rules</CardKicker>
            <div className="flex flex-col gap-3 mt-4">
              <div>
                <Label>Duration</Label>
                <select
                  className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
                  value={rules.durationMinutes}
                  onChange={(e) => setRules((r) => ({ ...r, durationMinutes: Number(e.target.value) }))}
                >
                  {[60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map((m) => (
                    <option key={m} value={m}>
                      {m / 60 === Math.floor(m / 60) ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${Math.floor(m / 60)}h ${m % 60}m`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Questions drawn</Label>
                  <Input value={`${bank.drawnTotal}`} disabled />
                </div>
                <div>
                  <Label>Pass mark</Label>
                  <Input
                    type="number"
                    value={rules.passMarkPercent}
                    onChange={(e) => setRules((r) => ({ ...r, passMarkPercent: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div>
                <Label>Attempts permitted</Label>
                <Segmented
                  name="attempts"
                  value={rules.attemptPolicy}
                  onChange={(v) => setRules((r) => ({ ...r, attemptPolicy: v as typeof r.attemptPolicy }))}
                  options={Object.entries(ATTEMPT_LABEL).map(([value, label]) => ({ value, label }))}
                />
              </div>
              <div>
                <Label>Exam fee</Label>
                <Input
                  value={(rules.feeMinor / 100).toString()}
                  onChange={(e) => setRules((r) => ({ ...r, feeMinor: Math.round(Number(e.target.value || 0) * 100) }))}
                  placeholder="Naira"
                />
              </div>
              <div>
                <Label>
                  Places available{currentWindow ? ` — window opening ${new Date(currentWindow.opensAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="flex-1"
                    value={capacityValue}
                    disabled={uncapped || !currentWindow}
                    placeholder="Uncapped"
                    onChange={(e) => setCapacityValue(e.target.value)}
                  />
                  <label className="flex-none flex items-center gap-1.5 text-[12px] text-neutral-700 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={uncapped}
                      disabled={!currentWindow}
                      onChange={(e) => setUncapped(e.target.checked)}
                      className="w-[15px] h-[15px] flex-none accent-accent"
                    />
                    <span>Uncapped</span>
                  </label>
                </div>
                <div className="text-neutral-500 text-[11.5px] mt-1.5 leading-snug">
                  {!currentWindow
                    ? "No window to configure yet."
                    : uncapped
                    ? "Any eligible candidate may register for this sitting. Proctoring capacity is not checked."
                    : `Registration closes automatically once ${capacityValue || "0"} places are taken. Candidates beyond that are offered the next window.`}
                </div>
              </div>
              <Button variant="secondary" onClick={saveRules} disabled={busy}>
                Save rules
              </Button>
            </div>
          </Card>

          <Card elev="sm">
            <CardKicker>Conduct &amp; proctoring</CardKicker>
            <div className="flex flex-col gap-2.5 mt-4">
              {(
                [
                  ["enforceFullScreen", "Require full screen", "Exiting full screen is logged as a proctoring event"],
                  ["warnOnTabSwitch", "Warn on tab switch", "Switching away from the paper is logged"],
                  ["shuffleQuestions", "Shuffle question order", "Each candidate sees a different order"],
                  ["shuffleOptions", "Shuffle answer options", "Each candidate sees options in a different order"],
                  ["allowReviewBeforeSubmit", "Allow review before submitting", "Candidates can revisit answers before the final submit"],
                ] as const
              ).map(([key, label, meta]) => (
                <label key={key} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rules[key]}
                    onChange={(e) => setRules((r) => ({ ...r, [key]: e.target.checked }))}
                    className="w-4 h-4 flex-none mt-0.5 accent-accent"
                  />
                  <div>
                    <div className="text-[12.5px] font-medium">{label}</div>
                    <div className="text-neutral-500 text-[11px] leading-snug">{meta}</div>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card elev="sm" className="bg-accent-100 border-accent-200">
            <div className="font-heading font-semibold text-[13px]">Candidate sees</div>
            <div className="text-accent-800 text-[12px] mt-1.5 leading-relaxed">{summary}</div>
          </Card>

          {windows.length > 0 && (
            <Card elev="sm">
              <CardKicker>Windows &amp; results</CardKicker>
              <div className="flex flex-col gap-2.5 mt-3">
                {windows.map((w) => (
                  <div key={w.id} className="px-3.5 py-3 rounded-md border border-neutral-200">
                    <div className="text-[12.5px] font-medium">{new Date(w.opensAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                    <div className="text-neutral-500 text-[11px] mt-1">
                      {w.registered} registered · {w.inProgress} sitting · {w.submitted} awaiting release · {w.released} released
                    </div>
                    {w.submitted > 0 && (
                      <Button variant="secondary" className="h-8 px-2.5 text-xs mt-2" disabled={releasingId === w.id} onClick={() => release(w.id)}>
                        {releasingId === w.id ? "Releasing…" : `Release ${w.submitted} result${w.submitted === 1 ? "" : "s"}`}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {retireTarget && (
        <Dialog open onClose={() => setRetireTarget(null)} title="Retire this question?">
          <p className="text-neutral-500 text-[12.5px]">{bank.modules.find((m) => m.id === retireTarget.moduleId)?.title}</p>
          <div className="p-3 rounded-md bg-neutral-100 border border-dashed border-neutral-300 text-[12.5px]">{retireTarget.question.prompt}</div>
          <p className="mt-3">
            A retired question is withdrawn from future draws but stays on the record — marks already awarded against it are untouched, and it can be
            restored at any time.
          </p>
          {retireWarning(retireTarget.moduleId, retireTarget.question) && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-md bg-[#fff7e6] border border-[#f0d9a8] mt-3 text-[12px] text-[#8a6013]">
              <span className="font-bold">!</span>
              {retireWarning(retireTarget.moduleId, retireTarget.question)}
            </div>
          )}
          <div className="mt-4">
            <Label>Reason (written to the audit log)</Label>
            <Input value={retireReason} onChange={(e) => setRetireReason(e.target.value)} placeholder="Superseded by the 2026 fiscal amendment" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setRetireTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy || !retireReason.trim()} onClick={confirmRetire}>
              Retire question
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function CardTitleRow({ bank }: { bank: Bank }) {
  const stats = [
    { label: "Total questions", value: bank.totalCount },
    { label: "Approved", value: bank.approvedCount },
    { label: "Drawn per sitting", value: bank.drawnTotal },
    { label: "Duration", value: `${bank.exam.durationMinutes / 60}h` },
  ];
  return (
    <div className="flex gap-5 mt-4 pt-4 border-t border-dashed border-neutral-300 flex-wrap">
      {stats.map((s) => (
        <div key={s.label}>
          <div className="font-heading font-bold text-[19px]">{s.value}</div>
          <div className="text-neutral-500 text-[11px] tracking-[0.06em] uppercase mt-0.5">{s.label}</div>
        </div>
      ))}
      <div className="ml-auto self-center text-neutral-500 text-[12px]">{formatNaira(bank.exam.feeMinor)} exam fee</div>
    </div>
  );
}

function QuestionFormCard({
  form,
  setForm,
  onCancel,
  onSubmit,
  busy,
  moduleOptions,
}: {
  form: QuestionFormState;
  setForm: (f: QuestionFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  moduleOptions: { id: string; title: string }[];
}) {
  return (
    <Card elev="sm" className="border-accent-300">
      <CardKicker>{form.mode === "create" ? "New question" : "Edit question"}</CardKicker>
      {form.mode === "edit" && <div className="text-neutral-500 text-[11.5px] -mt-1">Applies to future sittings only — a paper already in progress keeps its snapshot.</div>}

      <div className="mt-3">
        <Label>Question type</Label>
        <Segmented
          name="q-type"
          value={form.type}
          onChange={(v) => setForm({ ...form, type: v as "OBJECTIVE" | "WRITTEN" })}
          options={[
            { value: "OBJECTIVE", label: "Multiple choice" },
            { value: "WRITTEN", label: "Written answer" },
          ]}
          className={form.mode === "edit" ? "opacity-50 pointer-events-none" : ""}
        />
      </div>

      <div className="mt-3">
        <Label>Question</Label>
        <Textarea rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
      </div>

      {form.type === "WRITTEN" && (
        <div className="flex flex-col gap-3 mt-3">
          <div>
            <Label>Guidance shown to the candidate</Label>
            <Textarea rows={2} value={form.guidance} onChange={(e) => setForm({ ...form, guidance: e.target.value })} />
          </div>
          <div>
            <Label>Expected length (words)</Label>
            <Input value={form.wordLimit} onChange={(e) => setForm({ ...form, wordLimit: e.target.value })} />
          </div>
        </div>
      )}

      {form.type === "OBJECTIVE" && (
        <div className="flex flex-col gap-2 mt-3">
          <div className="text-neutral-500 text-[10.5px] tracking-[0.1em] uppercase">Options — mark the correct answer</div>
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <input
                type="radio"
                name="correct-opt"
                checked={o.isCorrect}
                onChange={() => setForm({ ...form, options: form.options.map((x, j) => ({ ...x, isCorrect: j === i })) })}
                className="w-4 h-4 flex-none accent-accent"
              />
              <Input
                className="flex-1"
                value={o.text}
                onChange={(e) => setForm({ ...form, options: form.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                placeholder={`Option ${i + 1}`}
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[2fr_1fr] gap-3 mt-4">
        <div>
          <Label>Module</Label>
          <select
            className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
            value={form.moduleId}
            onChange={(e) => setForm({ ...form, moduleId: e.target.value })}
            disabled={form.mode === "edit"}
          >
            {moduleOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Marks</Label>
          <Input value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
        </div>
      </div>
      <div className="mt-3">
        <Label>Status</Label>
        <select
          className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as QuestionFormState["status"] })}
        >
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In review</option>
          <option value="APPROVED">Approved</option>
        </select>
      </div>
      <div className="mt-3">
        <Label>Examiner note (shown after marking)</Label>
        <Input value={form.examinerNote} onChange={(e) => setForm({ ...form, examinerNote: e.target.value })} placeholder="Cites the default clause; see Module 1, Lecture 2." />
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={busy || !form.prompt.trim()}>
          {form.mode === "create" ? "Add to bank" : "Save changes"}
        </Button>
      </div>
    </Card>
  );
}
