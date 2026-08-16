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
  listProgrammesWithoutExamAction,
  listExamTopicsAction,
  createStandaloneExamAction,
  getQuestionUsageAction,
  getExamPreviewAction,
  createExamAction,
  createExamWindowAction,
  updateExamWindowAction,
  setExamContentAction,
  setExamRequirementsAction,
  closeExamAction,
  archiveExamAction,
} from "@/app/actions/exam-builder";
import { releaseResultsAction } from "@/app/actions/exam-sitting";
import type { listExamBank, listExamsForBuilder, listExamWindows, listProgrammesWithoutExam, getExamPreview } from "@/lib/exam-reads";
import type { PublishIssue } from "@/lib/exam-builder-actions";

type Bank = Awaited<ReturnType<typeof listExamBank>>;
type ExamListItem = Awaited<ReturnType<typeof listExamsForBuilder>>[number];
type Question = Bank["modules"][number]["questions"][number];
type ExamWindow = Awaited<ReturnType<typeof listExamWindows>>[number];
type ProgrammeWithoutExam = Awaited<ReturnType<typeof listProgrammesWithoutExam>>[number];
type ExamPreview = Awaited<ReturnType<typeof getExamPreview>>;

const STATUS_TAG_VARIANT: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  CLOSED: "warning",
  ARCHIVED: "neutral",
};

const STATUS_CAPTION: Record<string, string> = {
  DRAFT: "Draft — not visible to candidates",
  PUBLISHED: "Published — visible to eligible candidates",
  CLOSED: "Closed — no new registrations or attempts",
  ARCHIVED: "Archived — read-only historical record",
};

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

interface WindowFormState {
  mode: "create" | "edit";
  id?: string;
  opensAt: string;
  closesAt: string;
  registrationDeadline: string;
  capacity: string;
  uncapped: boolean;
}

function toDateInput(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 16);
}

function blankWindowForm(): WindowFormState {
  return { mode: "create", opensAt: "", closesAt: "", registrationDeadline: "", capacity: "", uncapped: true };
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
  const [publishIssues, setPublishIssues] = React.useState<PublishIssue[] | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = React.useState(false);
  const [showNewExamDialog, setShowNewExamDialog] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [preview, setPreview] = React.useState<ExamPreview | null>(null);
  const [questionUsage, setQuestionUsage] = React.useState<number | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = React.useState<"close" | "archive" | null>(null);
  const [content, setContent] = React.useState({
    description: bank.exam.description ?? "",
    instructions: bank.exam.instructions ?? "",
    examFormat: bank.exam.examFormat ?? "",
    examinationAreas: bank.exam.examinationAreas.length ? bank.exam.examinationAreas : [""],
    onPassing: bank.exam.onPassing.length ? bank.exam.onPassing : [""],
  });
  const [openToAll, setOpenToAll] = React.useState(bank.exam.requirements.length === 0);
  const [requirements, setRequirements] = React.useState<{ text: string; isMandatory: boolean }[]>(
    bank.exam.requirements.length ? bank.exam.requirements.map((r) => ({ text: r.text, isMandatory: r.isMandatory })) : [{ text: "", isMandatory: true }]
  );
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
  const [windowForm, setWindowForm] = React.useState<WindowFormState | null>(null);
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
      setQuestionUsage(null);
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

  async function confirmPublish() {
    setBusy(true);
    try {
      const result = await publishExamAction(bank.exam.id);
      setShowPublishConfirm(false);
      if (result.ok) {
        setPublishIssues(null);
        await refreshBank();
        router.refresh();
      } else {
        setPublishIssues(result.issues);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveContent() {
    setBusy(true);
    try {
      await setExamContentAction(bank.exam.id, {
        description: content.description,
        instructions: content.instructions,
        examFormat: content.examFormat,
        examinationAreas: content.examinationAreas,
        onPassing: content.onPassing,
      });
      await refreshBank();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveRequirements() {
    setBusy(true);
    try {
      await setExamRequirementsAction(bank.exam.id, openToAll ? [] : requirements);
      await refreshBank();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function openPreview() {
    setShowPreview(true);
    setPreview(await getExamPreviewAction(bank.exam.id));
  }

  async function openEditForm(moduleId: string, q: Question) {
    setForm(editForm(moduleId, q));
    setQuestionUsage(null);
    const usage = await getQuestionUsageAction(q.id);
    setQuestionUsage(usage.usedInSittings);
  }

  async function submitWindowForm() {
    if (!windowForm) return;
    setBusy(true);
    try {
      const input = {
        opensAt: new Date(windowForm.opensAt),
        closesAt: new Date(windowForm.closesAt),
        registrationDeadline: new Date(windowForm.registrationDeadline),
        capacity: windowForm.uncapped ? null : windowForm.capacity.trim() ? Number(windowForm.capacity) : null,
      };
      if (windowForm.mode === "create") {
        await createExamWindowAction(bank.exam.id, input);
      } else if (windowForm.id) {
        await updateExamWindowAction(bank.exam.id, windowForm.id, input);
      }
      setWindowForm(null);
      setWindows(await listExamWindowsAction(bank.exam.id));
      await refreshBank();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runLifecycleAction() {
    if (!lifecycleTarget) return;
    setBusy(true);
    try {
      if (lifecycleTarget === "close") await closeExamAction(bank.exam.id);
      else await archiveExamAction(bank.exam.id);
      setLifecycleTarget(null);
      await refreshBank();
      router.refresh();
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
          <div>
            <Tag variant={STATUS_TAG_VARIANT[bank.exam.status]}>{bank.exam.status}</Tag>
            <div className="text-neutral-500 text-[11px] mt-1">{STATUS_CAPTION[bank.exam.status]}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowNewExamDialog(true)}>
            + New examination
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/admin/exam-builder/${bank.exam.id}/candidates`)}>
            Candidates
          </Button>
          <Button variant="secondary" onClick={openPreview}>
            Preview as candidate
          </Button>
          {bank.exam.status === "DRAFT" && (
            <Button onClick={() => setShowPublishConfirm(true)} disabled={busy}>
              Publish examination
            </Button>
          )}
          {bank.exam.status === "PUBLISHED" && (
            <Button variant="secondary" className="border-[#e8b4ae] text-[#b42318]" onClick={() => setLifecycleTarget("close")} disabled={busy}>
              Close examination
            </Button>
          )}
          {bank.exam.status === "CLOSED" && (
            <Button variant="secondary" onClick={() => setLifecycleTarget("archive")} disabled={busy}>
              Archive examination
            </Button>
          )}
        </div>
      </div>

      {publishIssues && publishIssues.length > 0 && (
        <div className="flex flex-col gap-2.5 px-5 py-4 rounded-md bg-[#fff7e6] border border-[#f0d9a8]">
          <div className="flex items-center gap-2.5">
            <span className="w-[26px] h-[26px] flex-none rounded-full bg-[#fdf0d2] text-[#a16207] flex items-center justify-center text-sm font-bold">!</span>
            <div className="font-heading font-semibold text-[13.5px] text-[#7a4d06]">This examination cannot be published yet</div>
          </div>
          <ul className="flex flex-col gap-1.5 pl-9 list-disc text-[12.5px] text-[#8a6013]">
            {publishIssues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
      {bank.shortfalls.length > 0 && !publishIssues && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-md bg-[#fff7e6] border border-[#f0d9a8]">
          <span className="w-[26px] h-[26px] flex-none rounded-full bg-[#fdf0d2] text-[#a16207] flex items-center justify-center text-sm font-bold">!</span>
          <div>
            <div className="font-heading font-semibold text-[13.5px] text-[#7a4d06]">Question bank is short for the configured draw</div>
            <div className="text-[12.5px] text-[#8a6013] mt-0.5">
              {bank.shortfalls.map((s) => `${s.moduleTitle} — short by ${s.shortBy}`).join("; ")}
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

          <Card elev="sm">
            <CardKicker>Examination content</CardKicker>
            <p className="text-neutral-500 text-[11.5px] -mt-1">What candidates read before they register — none of this is hard-coded.</p>
            <div className="flex flex-col gap-3 mt-3">
              <div>
                <Label>About this examination</Label>
                <Textarea rows={3} value={content.description} onChange={(e) => setContent((c) => ({ ...c, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Format</Label>
                  <Input value={content.examFormat} onChange={(e) => setContent((c) => ({ ...c, examFormat: e.target.value }))} placeholder="Objective + written" />
                </div>
                <div>
                  <Label>Candidate instructions</Label>
                  <Input value={content.instructions} onChange={(e) => setContent((c) => ({ ...c, instructions: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
              <ListEditor
                label="What is examined"
                items={content.examinationAreas}
                onChange={(items) => setContent((c) => ({ ...c, examinationAreas: items }))}
                placeholder="Upstream petroleum contracts, licensing and the award process"
              />
              <ListEditor
                label="On passing"
                items={content.onPassing}
                onChange={(items) => setContent((c) => ({ ...c, onPassing: items }))}
                placeholder="Specialist Certificate in Energy Law & Regulation"
              />
              <Button variant="secondary" onClick={saveContent} disabled={busy} className="self-start">
                Save content
              </Button>
            </div>
          </Card>

          <Card elev="sm">
            <CardKicker>Eligibility</CardKicker>
            <p className="text-neutral-500 text-[11.5px] -mt-1">What candidates see about who this examination is for.</p>
            <div className="flex flex-col gap-3 mt-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openToAll}
                  onChange={(e) => setOpenToAll(e.target.checked)}
                  className="w-4 h-4 flex-none mt-0.5 accent-accent"
                />
                <div>
                  <div className="text-[12.5px] font-medium">Open to all candidates</div>
                  <div className="text-neutral-500 text-[11px] leading-snug">No prerequisites required. Uncheck to list eligibility notes.</div>
                </div>
              </label>

              {!openToAll && (
                <div className="flex flex-col gap-2">
                  {requirements.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        value={r.text}
                        placeholder="A valid law degree or equivalent professional qualification"
                        onChange={(e) => setRequirements(requirements.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                      />
                      <label className="flex-none flex items-center gap-1.5 text-[11.5px] text-neutral-700 cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={r.isMandatory}
                          onChange={(e) => setRequirements(requirements.map((x, j) => (j === i ? { ...x, isMandatory: e.target.checked } : x)))}
                          className="w-[15px] h-[15px] flex-none accent-accent"
                        />
                        <span>Required</span>
                      </label>
                      <button
                        type="button"
                        className="text-neutral-500 text-[12px] flex-none cursor-pointer px-1.5"
                        onClick={() => setRequirements(requirements.length > 1 ? requirements.filter((_, j) => j !== i) : [{ text: "", isMandatory: true }])}
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-accent text-[12px] font-medium cursor-pointer self-start"
                    onClick={() => setRequirements([...requirements, { text: "", isMandatory: true }])}
                  >
                    + Add requirement
                  </button>
                </div>
              )}
              <Button variant="secondary" onClick={saveRequirements} disabled={busy} className="self-start">
                Save eligibility
              </Button>
            </div>
          </Card>

          {form && (
            <QuestionFormCard
              form={form}
              setForm={setForm}
              onCancel={() => {
                setForm(null);
                setQuestionUsage(null);
              }}
              onSubmit={submitForm}
              busy={busy}
              moduleOptions={bank.modules.map((m) => ({ id: m.id, title: m.title }))}
              usedInSittings={form.mode === "edit" ? questionUsage : null}
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
                    <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Module {mod.weekNumber}</div>
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
                              <Button variant="secondary" className="h-[30px] px-[10px] text-xs" onClick={() => openEditForm(mod.id, q)}>
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
                        + Add question to Module {mod.weekNumber}
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

          <Card elev="sm">
            <div className="flex items-center justify-between">
              <CardKicker>Sittings</CardKicker>
              <button className="text-accent text-[12px] font-medium cursor-pointer" onClick={() => setWindowForm(blankWindowForm())}>
                + Add sitting
              </button>
            </div>
            {windows.length === 0 ? (
              <div className="text-center py-6">
                <div className="font-heading font-semibold text-[13px]">No examination sittings have been configured</div>
                <p className="text-neutral-600 text-[12px] mt-1.5 max-w-[36ch] mx-auto">
                  Sittings define when candidates can register and sit the examination.
                </p>
                <button className="text-accent text-[12.5px] font-medium cursor-pointer mt-2" onClick={() => setWindowForm(blankWindowForm())}>
                  + Add examination sitting
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 mt-3">
                {windows.map((w) => (
                  <div key={w.id} className="px-3.5 py-3 rounded-md border border-neutral-200">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[12.5px] font-medium">{new Date(w.opensAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                        <div className="text-neutral-500 text-[11px] mt-1">
                          Registration closes {new Date(w.registrationDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                          {w.capacity == null ? "Uncapped" : `${w.capacity} places`}
                        </div>
                      </div>
                      <button
                        className="text-accent text-[11.5px] font-medium cursor-pointer flex-none"
                        onClick={() =>
                          setWindowForm({
                            mode: "edit",
                            id: w.id,
                            opensAt: toDateInput(w.opensAt),
                            closesAt: toDateInput(w.closesAt),
                            registrationDeadline: toDateInput(w.registrationDeadline),
                            capacity: w.capacity != null ? String(w.capacity) : "",
                            uncapped: w.capacity == null,
                          })
                        }
                      >
                        Edit
                      </button>
                    </div>
                    <div className="text-neutral-500 text-[11px] mt-2">
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
            )}
          </Card>
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

      {windowForm && (
        <Dialog open onClose={() => setWindowForm(null)} title={windowForm.mode === "create" ? "Add examination sitting" : "Edit examination sitting"}>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Examination window opens</Label>
              <input
                type="datetime-local"
                className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
                value={windowForm.opensAt}
                onChange={(e) => setWindowForm({ ...windowForm, opensAt: e.target.value })}
              />
            </div>
            <div>
              <Label>Examination window closes</Label>
              <input
                type="datetime-local"
                className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
                value={windowForm.closesAt}
                onChange={(e) => setWindowForm({ ...windowForm, closesAt: e.target.value })}
              />
            </div>
            <div>
              <Label>Registration closes</Label>
              <input
                type="datetime-local"
                className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
                value={windowForm.registrationDeadline}
                onChange={(e) => setWindowForm({ ...windowForm, registrationDeadline: e.target.value })}
              />
              <div className="text-neutral-500 text-[11.5px] mt-1.5">Must be before the window opens.</div>
            </div>
            <div>
              <Label>Capacity</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="flex-1"
                  value={windowForm.capacity}
                  disabled={windowForm.uncapped}
                  placeholder="Uncapped"
                  onChange={(e) => setWindowForm({ ...windowForm, capacity: e.target.value })}
                />
                <label className="flex-none flex items-center gap-1.5 text-[12px] text-neutral-700 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={windowForm.uncapped}
                    onChange={(e) => setWindowForm({ ...windowForm, uncapped: e.target.checked })}
                    className="w-[15px] h-[15px] flex-none accent-accent"
                  />
                  <span>Uncapped</span>
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setWindowForm(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !windowForm.opensAt || !windowForm.closesAt || !windowForm.registrationDeadline}
              onClick={submitWindowForm}
            >
              {windowForm.mode === "create" ? "Add sitting" : "Save changes"}
            </Button>
          </div>
        </Dialog>
      )}

      {showPublishConfirm && (
        <Dialog open onClose={() => setShowPublishConfirm(false)} title="Publish examination?">
          <p>
            Once published, this examination will become available to eligible candidates according to its configured registration and
            examination schedule.
          </p>
          <p className="mt-2">
            Questions already used by candidates cannot be modified. Future edits to used questions create a new version, and
            candidates who already sat the examination keep the version they answered — their marks are unaffected.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setShowPublishConfirm(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={confirmPublish}>
              {busy ? "Publishing…" : "Publish examination"}
            </Button>
          </div>
        </Dialog>
      )}

      {lifecycleTarget && (
        <Dialog
          open
          onClose={() => setLifecycleTarget(null)}
          title={lifecycleTarget === "close" ? "Close this examination?" : "Archive this examination?"}
        >
          <p>
            {lifecycleTarget === "close"
              ? "No new candidate can register or sit this examination once closed. Historical registrations, sittings and results are unaffected."
              : "The examination becomes a read-only historical record. It can no longer be edited except by an authorised administrative action."}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setLifecycleTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={runLifecycleAction}>
              {lifecycleTarget === "close" ? "Close examination" : "Archive examination"}
            </Button>
          </div>
        </Dialog>
      )}

      {showPreview && (
        <Dialog open onClose={() => setShowPreview(false)} title="Preview">
          {!preview ? (
            <div className="text-neutral-500 text-[12.5px] py-4">Loading preview…</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Tag variant="warning">Preview</Tag>
                <span className="text-neutral-500 text-[11.5px]">This is exactly what an eligible candidate sees before registering — no correct answers, examiner notes or bank statistics.</span>
              </div>
              <div>
                <div className="font-heading font-bold text-[18px]">{preview.programme.title}</div>
                <div className="text-neutral-500 text-[12.5px] mt-0.5">
                  {preview.programme.code} · {preview.programme.categoryName} · {preview.programme.tier}
                </div>
              </div>
              {preview.exam.description && <p className="text-[13px] leading-relaxed">{preview.exam.description}</p>}
              <div className="grid grid-cols-3 gap-3">
                <PreviewStat label="Format" value={preview.exam.examFormat || "—"} />
                <PreviewStat label="Duration" value={`${preview.exam.durationMinutes / 60}h`} />
                <PreviewStat label="Pass standard" value={`${preview.exam.passMarkPercent}%`} />
              </div>
              {preview.exam.examinationAreas.length > 0 && (
                <div>
                  <div className="font-heading font-semibold text-[12.5px] uppercase tracking-[0.05em] text-neutral-500">What is examined</div>
                  <ul className="list-disc pl-5 mt-1.5 flex flex-col gap-1 text-[13px]">
                    {preview.exam.examinationAreas.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.exam.onPassing.length > 0 && (
                <div>
                  <div className="font-heading font-semibold text-[12.5px] uppercase tracking-[0.05em] text-neutral-500">On passing</div>
                  <ul className="list-disc pl-5 mt-1.5 flex flex-col gap-1 text-[13px]">
                    {preview.exam.onPassing.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="font-heading font-semibold text-[12.5px] uppercase tracking-[0.05em] text-neutral-500">Eligibility</div>
                {preview.exam.requirements.length === 0 ? (
                  <p className="text-[13px] mt-1.5">Open to all candidates.</p>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {preview.exam.requirements.map((r) => (
                      <li key={r.id} className="flex items-start gap-2 text-[13px]">
                        <Tag variant={r.isMandatory ? "danger" : "neutral"} className="mt-0.5 flex-none">
                          {r.isMandatory ? "Required" : "Recommended"}
                        </Tag>
                        <span>{r.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="font-heading font-semibold text-[12.5px] uppercase tracking-[0.05em] text-neutral-500">Sittings</div>
                {preview.windows.length === 0 ? (
                  <p className="text-neutral-500 text-[12.5px] mt-1.5">No sittings scheduled yet.</p>
                ) : (
                  <div className="flex flex-col gap-2 mt-1.5">
                    {preview.windows.map((w) => (
                      <div key={w.id} className="px-3 py-2.5 rounded-md border border-neutral-200 text-[12.5px]">
                        {new Date(w.opensAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · Registration
                        closes {new Date(w.registrationDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                        {w.capacity == null ? "Places available" : `${w.capacity} places`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-neutral-500 text-[12.5px]">{formatNaira(preview.exam.feeMinor)} examination fee</div>
              <Button disabled className="self-start opacity-50 cursor-not-allowed">
                Enrol in this examination
              </Button>
            </div>
          )}
        </Dialog>
      )}

      {showNewExamDialog && <NewExaminationDialog onClose={() => setShowNewExamDialog(false)} onCreated={(id) => router.push(`/admin/exam-builder?examId=${id}`)} />}
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-heading font-bold text-[15px]">{value}</div>
      <div className="text-neutral-500 text-[10.5px] tracking-[0.06em] uppercase mt-0.5">{label}</div>
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="flex-1"
              value={item}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((it, j) => (j === i ? e.target.value : it)))}
            />
            <button
              type="button"
              className="text-neutral-500 text-[12px] flex-none cursor-pointer px-1.5"
              onClick={() => onChange(items.length > 1 ? items.filter((_, j) => j !== i) : [""])}
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="text-accent text-[12px] font-medium cursor-pointer self-start" onClick={() => onChange([...items, ""])}>
          + Add line
        </button>
      </div>
    </div>
  );
}

/** The page-level empty state when no programme has an examination yet — no bank exists to render the full builder against. */
export function NewExamEmptyState() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="max-w-[900px] text-center py-16">
      <div className="font-heading font-semibold text-[16px]">No programmes have an examination yet</div>
      <p className="text-neutral-600 text-[13px] mt-1.5">Create one for a programme to start building its question bank.</p>
      <Button className="mt-4" onClick={() => setOpen(true)}>
        + New examination
      </Button>
      {open && <NewExaminationDialog onClose={() => setOpen(false)} onCreated={(id) => router.push(`/admin/exam-builder?examId=${id}`)} />}
    </div>
  );
}

function NewExaminationDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (examId: string) => void }) {
  const [mode, setMode] = React.useState<"standalone" | "linked">("standalone");

  return (
    <Dialog open onClose={onClose} title="New examination">
      <Segmented
        name="new-exam-mode"
        value={mode}
        onChange={(v) => setMode(v as typeof mode)}
        options={[
          { value: "standalone", label: "Standalone exam" },
          { value: "linked", label: "Link to a programme" },
        ]}
      />
      {mode === "standalone" ? <StandaloneExamForm onClose={onClose} onCreated={onCreated} /> : <LinkedExamForm onClose={onClose} onCreated={onCreated} />}
    </Dialog>
  );
}

function StandaloneExamForm({ onClose, onCreated }: { onClose: () => void; onCreated: (examId: string) => void }) {
  const [topics, setTopics] = React.useState<{ id: string; name: string }[] | null>(null);
  const [title, setTitle] = React.useState("");
  const [code, setCode] = React.useState("");
  const [tier, setTier] = React.useState<"FOUNDATION" | "SPECIALIST">("SPECIALIST");
  const [topicId, setTopicId] = React.useState<string>("__new__");
  const [newTopicName, setNewTopicName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    listExamTopicsAction().then((rows) => {
      setTopics(rows);
      if (rows.length > 0) setTopicId(rows[0].id);
    });
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const exam = await createStandaloneExamAction({
        title,
        code,
        tier,
        categoryId: topicId === "__new__" ? undefined : topicId,
        newCategoryName: topicId === "__new__" ? newTopicName : undefined,
      });
      onCreated(exam.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the examination.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = title.trim() && code.trim() && (topicId !== "__new__" || newTopicName.trim());

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-neutral-500 text-[11.5px] -mt-1">Independent of any Lavelle programme — for any topic, whether or not a course exists for it.</p>
      <div>
        <Label>Examination title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Advanced Marketing Examination" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Examination code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MKT-401" />
        </div>
        <div>
          <Label>Level</Label>
          <Segmented name="new-exam-tier" value={tier} onChange={(v) => setTier(v as typeof tier)} options={[{ value: "FOUNDATION", label: "Foundation" }, { value: "SPECIALIST", label: "Specialist" }]} />
        </div>
      </div>
      <div>
        <Label>Topic / specialization</Label>
        {!topics ? (
          <div className="text-neutral-500 text-[12px]">Loading topics…</div>
        ) : (
          <select
            className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="__new__">+ Create new topic</option>
          </select>
        )}
        {topicId === "__new__" && (
          <Input className="mt-2" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} placeholder="New topic name" />
        )}
      </div>
      {error && <div className="text-[#b42318] text-[12.5px]">{error}</div>}
      <div className="flex justify-end gap-2 mt-1">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !canSubmit} onClick={submit}>
          {busy ? "Creating…" : "Create examination"}
        </Button>
      </div>
    </div>
  );
}

function LinkedExamForm({ onClose, onCreated }: { onClose: () => void; onCreated: (examId: string) => void }) {
  const [programmes, setProgrammes] = React.useState<ProgrammeWithoutExam[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    listProgrammesWithoutExamAction().then((rows) => {
      setProgrammes(rows);
      setSelectedId(rows[0]?.id ?? null);
    });
  }, []);

  async function submit() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const exam = await createExamAction(selectedId);
      onCreated(exam.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {!programmes ? (
        <div className="text-neutral-500 text-[12.5px] py-4">Loading programmes…</div>
      ) : programmes.length === 0 ? (
        <p className="text-neutral-600 text-[12.5px]">Every programme already has an examination.</p>
      ) : (
        <div>
          <Label>Programme</Label>
          <select
            className="w-full h-[42px] border border-neutral-300 rounded-md px-3 text-[13px] bg-bg"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.code})
              </option>
            ))}
          </select>
          <p className="text-neutral-500 text-[11.5px] mt-2">
            Creates a draft examination certifying this programme, with default rules — configure everything else in the builder.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !selectedId} onClick={submit}>
          {busy ? "Creating…" : "Create examination"}
        </Button>
      </div>
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
  usedInSittings,
}: {
  form: QuestionFormState;
  setForm: (f: QuestionFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  moduleOptions: { id: string; title: string }[];
  usedInSittings?: number | null;
}) {
  return (
    <Card elev="sm" className="border-accent-300">
      <CardKicker>{form.mode === "create" ? "New question" : "Edit question"}</CardKicker>
      {form.mode === "edit" && <div className="text-neutral-500 text-[11.5px] -mt-1">Applies to future sittings only — a paper already in progress keeps its snapshot.</div>}
      {form.mode === "edit" && usedInSittings != null && usedInSittings > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-md bg-[#fff7e6] border border-[#f0d9a8] mt-2 text-[12px] text-[#8a6013]">
          <span className="font-bold">!</span>
          <span>
            This question has already been answered in {usedInSittings} sitting{usedInSittings === 1 ? "" : "s"}. Your changes apply to future
            sittings only — existing answers and marks are unaffected.
          </span>
        </div>
      )}

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
