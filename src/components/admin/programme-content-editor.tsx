"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import {
  addModule,
  updateModule,
  reorderModules,
  addLecture,
  updateLecture,
  reorderLectures,
  setNarration,
  addSlide,
  updateSlide,
  reorderSlides,
  deleteSlide,
  upsertQuiz,
  setLectureStatus,
  setQuizStatus,
} from "@/app/actions/programme-content";
import { setProgrammeStatus } from "@/app/actions/programme";
import { finaliseUpload } from "@/app/actions/uploads";
import { formatNaira, statusLabel } from "@/lib/format";

// ── Types — a plain mirror of getProgrammeContent()'s shape, kept free of
// server-only Prisma-client imports so this file stays a clean client component. ──

type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface AssetRef {
  id: string;
  storageKey: string;
  durationSeconds: number | null;
  mimeType: string;
  originalFilename: string;
}
interface SlideData {
  id: string;
  orderIndex: number;
  title: string | null;
  body: string | null;
  narrationAsset: AssetRef | null;
  imageAsset: AssetRef | null;
}
interface LectureData {
  id: string;
  orderIndex: number;
  title: string;
  status: ContentStatus;
  mediaKind: "SLIDES" | "VIDEO";
  videoUrl: string | null;
  narrationMode: "NONE" | "PER_SLIDE" | "FULL_LECTURE";
  narrationAutoAdvance: boolean;
  narrationRequireFull: boolean;
  fullNarrationAsset: AssetRef | null;
  videoAsset: AssetRef | null;
  scenarioPrompt: string | null;
  scenarioGuidance: string | null;
  draftingPrompt: string | null;
  draftingWordLimit: number | null;
  slides: SlideData[];
}
interface QuizOptionData {
  id: string;
  orderIndex: number;
  text: string;
  isCorrect: boolean;
}
interface QuizQuestionData {
  id: string;
  orderIndex: number;
  prompt: string;
  marks: number;
  explanation: string | null;
  options: QuizOptionData[];
}
interface QuizData {
  id: string;
  status: ContentStatus;
  passMarkPercent: number;
  questions: QuizQuestionData[];
}
interface ModuleData {
  id: string;
  weekNumber: number;
  title: string;
  summary: string | null;
  examQuestionDraw: number;
  orderIndex: number;
  lectures: LectureData[];
  quiz: QuizData | null;
}
interface AssessmentWeightingData {
  kind: string;
  weightPercent: number;
}
interface ProgrammeData {
  id: string;
  code: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  feeMinor: number;
  modules: ModuleData[];
  assessmentWeightings: AssessmentWeightingData[];
}

function computeDuration(lecture: LectureData): { seconds: number | null; label: string } {
  if (lecture.narrationMode === "FULL_LECTURE" && lecture.fullNarrationAsset?.durationSeconds) {
    return { seconds: lecture.fullNarrationAsset.durationSeconds, label: fmt(lecture.fullNarrationAsset.durationSeconds) };
  }
  if (lecture.narrationMode === "PER_SLIDE" && lecture.slides.length) {
    const known = lecture.slides.map((s) => s.narrationAsset?.durationSeconds).filter((n): n is number => !!n);
    if (known.length) return { seconds: known.reduce((a, b) => a + b, 0), label: fmt(known.reduce((a, b) => a + b, 0)) };
  }
  if (lecture.videoAsset?.durationSeconds) {
    return { seconds: lecture.videoAsset.durationSeconds, label: fmt(lecture.videoAsset.durationSeconds) };
  }
  return { seconds: null, label: "Duration pending" };
}
function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const contentStatusLabel: Record<ContentStatus, string> = { DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived" };

/** A compact select doubling as the status badge — used for both lectures and the module quiz. */
function ContentStatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: ContentStatus;
  onChange: (status: ContentStatus) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onChange(e.target.value as ContentStatus);
      }}
      className="h-6 flex-none rounded border border-neutral-300 bg-bg px-1 text-[10.5px]"
    >
      {(Object.keys(contentStatusLabel) as ContentStatus[]).map((s) => (
        <option key={s} value={s}>
          {contentStatusLabel[s]}
        </option>
      ))}
    </select>
  );
}

async function uploadFile(file: File, kind: "audio" | "video" | "image" | "document") {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, mimeType: file.type, bytes: file.size }),
  });
  if (!signRes.ok) throw new Error("Could not get an upload URL.");
  const { storageKey, uploadUrl } = await signRes.json();
  const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
  if (!putRes.ok) throw new Error("Upload failed.");
  return finaliseUpload({ storageKey, kind, mimeType: file.type, originalFilename: file.name });
}

export function ProgrammeContentEditor({ programme }: { programme: ProgrammeData }) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState<string | null>(programme.modules[0]?.id ?? null);
  const [selectedLectureId, setSelectedLectureId] = React.useState<string | null>(
    programme.modules[0]?.lectures[0]?.id ?? null
  );
  const [quizModuleId, setQuizModuleId] = React.useState<string | null>(null);
  const [publishErrors, setPublishErrors] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const selectedLecture = programme.modules.flatMap((m) => m.lectures).find((l) => l.id === selectedLectureId) ?? null;
  const selectedLectureModule = programme.modules.find((m) => m.lectures.some((l) => l.id === selectedLectureId));

  function refresh() {
    router.refresh();
  }

  async function handleAddModule() {
    setBusy(true);
    try {
      const nextWeek = Math.max(0, ...programme.modules.map((m) => m.weekNumber)) + 1;
      await addModule(programme.id, { weekNumber: nextWeek, title: "Untitled module" });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLecture(moduleId: string) {
    setBusy(true);
    try {
      const lecture = await addLecture(moduleId, { title: "Untitled lecture", mediaKind: "SLIDES" });
      setSelectedLectureId(lecture.id);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSetLectureStatus(lectureId: string, status: ContentStatus) {
    setBusy(true);
    try {
      await setLectureStatus(lectureId, status);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSetQuizStatus(quizId: string, status: ContentStatus) {
    setBusy(true);
    try {
      await setQuizStatus(quizId, status);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function moveModule(moduleId: string, dir: -1 | 1) {
    const ordered = [...programme.modules].sort((a, b) => a.orderIndex - b.orderIndex).map((m) => m.id);
    const idx = ordered.indexOf(moduleId);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    [ordered[idx], ordered[swapWith]] = [ordered[swapWith]!, ordered[idx]!];
    setBusy(true);
    try {
      await reorderModules(programme.id, ordered);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function moveLecture(moduleId: string, lectureId: string, dir: -1 | 1) {
    const mod = programme.modules.find((m) => m.id === moduleId)!;
    const ordered = [...mod.lectures].sort((a, b) => a.orderIndex - b.orderIndex).map((l) => l.id);
    const idx = ordered.indexOf(lectureId);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    [ordered[idx], ordered[swapWith]] = [ordered[swapWith]!, ordered[idx]!];
    setBusy(true);
    try {
      await reorderLectures(moduleId, ordered);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSetStatus(status: "DRAFT" | "ACTIVE" | "ARCHIVED") {
    setPublishErrors(null);
    setBusy(true);
    try {
      await setProgrammeStatus(programme.id, status);
      refresh();
    } catch (e) {
      const failures = (e as { failures?: string[] })?.failures;
      setPublishErrors(failures ?? [(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  const totalWeight = programme.assessmentWeightings.reduce((a, w) => a + w.weightPercent, 0);

  return (
    <div className="max-w-[1400px]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.1em] text-accent uppercase">Step 2 of 2 — Course content</div>
          <h2 className="mt-1 mb-0">
            {programme.title} <span className="text-neutral-500">· {programme.code}</span>
          </h2>
          <div className="mt-1 flex items-center gap-2 text-[12.5px] text-neutral-600">
            <Tag variant={programme.status === "ACTIVE" ? "success" : "neutral"}>{statusLabel(programme.status)}</Tag>
            <span>{formatNaira(programme.feeMinor)}</span>
            <span>· Weights {totalWeight}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/programmes/${programme.id}/edit`} className="text-sm text-accent">
            ← Details
          </Link>
          {programme.status !== "ARCHIVED" && (
            <Button variant="secondary" disabled={busy} onClick={() => handleSetStatus("ARCHIVED")}>
              Archive
            </Button>
          )}
          {programme.status === "ARCHIVED" && (
            // Back to DRAFT, not straight to ACTIVE — re-publishing still has
            // to pass the publish checks below, same as any other draft.
            <Button disabled={busy} onClick={() => handleSetStatus("DRAFT")}>
              Unarchive
            </Button>
          )}
          {programme.status === "DRAFT" && (
            <Button disabled={busy} onClick={() => handleSetStatus("ACTIVE")}>
              Publish to catalogue
            </Button>
          )}
          {programme.status === "ACTIVE" && (
            <Button variant="secondary" disabled={busy} onClick={() => handleSetStatus("DRAFT")}>
              Revert to draft
            </Button>
          )}
        </div>
      </div>

      {publishErrors && (
        <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] p-3.5 text-[13px] text-[#912019]">
          <div className="mb-1 font-heading font-semibold">Can&rsquo;t publish yet</div>
          <ul className="list-disc pl-5">
            {publishErrors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-6">
        <div className="flex flex-col gap-3">
          {programme.modules
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((mod) => (
              <div key={mod.id} className="overflow-hidden rounded-md border border-divider">
                <div className="flex items-center gap-2 bg-neutral-100 px-3 py-2.5">
                  <div className="flex flex-none flex-col gap-0.5">
                    <button onClick={() => moveModule(mod.id, -1)} className="text-[10px] text-neutral-500" aria-label="Move up">
                      ▲
                    </button>
                    <button onClick={() => moveModule(mod.id, 1)} className="text-[10px] text-neutral-500" aria-label="Move down">
                      ▼
                    </button>
                  </div>
                  <button
                    onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <Tag variant="neutral">Week {mod.weekNumber}</Tag>
                    <span className="font-heading text-[13.5px] font-semibold">{mod.title}</span>
                    <span className="ml-auto text-[11.5px] text-neutral-600">{mod.lectures.length} lectures</span>
                    <span className="text-xs text-neutral-500">{expanded === mod.id ? "▾" : "▸"}</span>
                  </button>
                </div>

                {expanded === mod.id && (
                  <div className="flex flex-col gap-3 p-3">
                    <div>
                      <input
                        defaultValue={mod.title}
                        onBlur={(e) => e.target.value !== mod.title && updateModule(mod.id, { title: e.target.value }).then(refresh)}
                        className="mb-1 h-9 w-full rounded-md border border-neutral-300 bg-bg px-2.5 text-sm"
                        placeholder="Chapter title"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {mod.lectures
                        .slice()
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                        .map((lec, li) => (
                          <div
                            key={lec.id}
                            onClick={() => setSelectedLectureId(lec.id)}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2"
                            style={{
                              borderColor: selectedLectureId === lec.id ? "var(--color-accent-300)" : "var(--color-divider)",
                              background: selectedLectureId === lec.id ? "var(--color-accent-100)" : "transparent",
                            }}
                          >
                            <span className="w-5 flex-none text-[11.5px] text-neutral-500">{li + 1}.</span>
                            <span className="flex-1 text-[13px]">{lec.title}</span>
                            <ContentStatusSelect
                              value={lec.status}
                              disabled={busy}
                              onChange={(status) => handleSetLectureStatus(lec.id, status)}
                            />
                            <span className="flex flex-none gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveLecture(mod.id, lec.id, -1);
                                }}
                                className="text-[10px] text-neutral-500"
                              >
                                ▲
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveLecture(mod.id, lec.id, 1);
                                }}
                                className="text-[10px] text-neutral-500"
                              >
                                ▼
                              </button>
                            </span>
                          </div>
                        ))}
                      <Button variant="secondary" onClick={() => handleAddLecture(mod.id)} disabled={busy} className="self-start px-[11px] py-[5px] text-xs">
                        + Add lecture
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuizModuleId(quizModuleId === mod.id ? null : mod.id)}
                        className="self-start text-xs font-medium text-accent"
                      >
                        Module quiz ({mod.quiz?.questions.length ?? 0} questions) {quizModuleId === mod.id ? "▾" : "▸"}
                      </button>
                      {mod.quiz && (
                        <ContentStatusSelect
                          value={mod.quiz.status}
                          disabled={busy}
                          onChange={(status) => handleSetQuizStatus(mod.quiz!.id, status)}
                        />
                      )}
                    </div>
                    {quizModuleId === mod.id && <ModuleQuizEditor mod={mod} onSaved={refresh} />}
                  </div>
                )}
              </div>
            ))}
          <Button variant="secondary" onClick={handleAddModule} disabled={busy} className="self-start">
            + Add module / week
          </Button>
        </div>

        <div>
          {!selectedLecture && (
            <div className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
              Select a lecture to author it.
            </div>
          )}
          {selectedLecture && selectedLectureModule && (
            <LectureEditor
              lecture={selectedLecture}
              moduleTitle={selectedLectureModule.title}
              weekNumber={selectedLectureModule.weekNumber}
              onSaved={refresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lecture editor — media / narration / scenario / drafting tabs, in place. ──

type Tab = "media" | "narration" | "scenario" | "drafting";

function LectureEditor({
  lecture,
  moduleTitle,
  weekNumber,
  onSaved,
}: {
  lecture: LectureData;
  moduleTitle: string;
  weekNumber: number;
  onSaved: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("media");
  const duration = computeDuration(lecture);
  const narrationWarning =
    lecture.narrationMode === "PER_SLIDE" && lecture.slides.length
      ? (() => {
          const missing = lecture.slides.filter((s) => !s.narrationAsset).length;
          return missing > 0 ? `${missing} of ${lecture.slides.length} slides missing narration` : null;
        })()
      : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="card-kicker">Authoring lecture</div>
          <div className="mt-0.5 font-heading text-[15px] font-semibold">{lecture.title}</div>
          <div className="text-xs text-neutral-600">
            Week {weekNumber} · {moduleTitle}
          </div>
        </div>
        <div className="flex overflow-hidden rounded-md border border-neutral-300">
          {(["media", "narration", "scenario", "drafting"] as Tab[]).map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={i > 0 ? "border-l border-neutral-300 px-3 py-1.5 text-xs font-medium capitalize" : "px-3 py-1.5 text-xs font-medium capitalize"}
              style={{
                background: tab === t ? "var(--color-accent-100)" : "transparent",
                color: tab === t ? "var(--color-accent)" : "var(--color-text)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <input
          defaultValue={lecture.title}
          onBlur={(e) => e.target.value !== lecture.title && updateLecture(lecture.id, { title: e.target.value }).then(onSaved)}
          className="h-9 w-full max-w-sm rounded-md border border-neutral-300 bg-bg px-2.5 text-sm"
        />
      </div>

      {tab === "media" && (
        <MediaTab lecture={lecture} duration={duration} narrationWarning={narrationWarning} onSaved={onSaved} />
      )}
      {tab === "narration" && <NarrationTab lecture={lecture} onSaved={onSaved} />}
      {tab === "scenario" && <ScenarioTab lecture={lecture} onSaved={onSaved} />}
      {tab === "drafting" && <DraftingTab lecture={lecture} onSaved={onSaved} />}
    </div>
  );
}

function MediaTab({
  lecture,
  duration,
  narrationWarning,
  onSaved,
}: {
  lecture: LectureData;
  duration: { seconds: number | null; label: string };
  narrationWarning: string | null;
  onSaved: () => void;
}) {
  const [uploading, setUploading] = React.useState(false);

  async function handleVideoUpload(file: File) {
    setUploading(true);
    try {
      const asset = await uploadFile(file, "video");
      await updateLecture(lecture.id, { videoAssetId: asset.id });
      onSaved();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700">Video</label>
          <div className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-md border-[1.5px] border-dashed border-neutral-300">
            {lecture.videoAsset ? (
              <div className="text-center text-xs text-neutral-600">
                {lecture.videoAsset.originalFilename}
                <br />
                {duration.label}
              </div>
            ) : (
              <div className="text-xs text-neutral-500">MP4 up to 2GB</div>
            )}
            <label className="cursor-pointer text-xs font-medium text-accent">
              {uploading ? "Uploading…" : "Upload video"}
              <input
                type="file"
                accept="video/*"
                hidden
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
              />
            </label>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-700">Lecture duration</label>
          <div className="flex min-h-10 items-center gap-2.5 rounded-md border border-dashed border-neutral-300 bg-neutral-100 px-3 py-2">
            <span className="text-sm font-medium">{duration.label}</span>
          </div>
          <div className="mt-1.5 text-[11.5px] text-neutral-600">
            Derived from uploaded narration or video — there is no field to type it.
          </div>
        </div>
      </div>
      {narrationWarning && (
        <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-text">
          {narrationWarning} — authorable, not blocking.
        </div>
      )}
    </div>
  );
}

function NarrationTab({ lecture, onSaved }: { lecture: LectureData; onSaved: () => void }) {
  const [mode, setMode] = React.useState(lecture.narrationMode);
  const [autoAdvance, setAutoAdvance] = React.useState(lecture.narrationAutoAdvance);
  const [requireFull, setRequireFull] = React.useState(lecture.narrationRequireFull);
  const [saving, setSaving] = React.useState(false);
  const [uploadingFull, setUploadingFull] = React.useState(false);

  async function save(next: Partial<{ narrationMode: typeof mode; narrationAutoAdvance: boolean; narrationRequireFull: boolean; fullNarrationAssetId: string | null }>) {
    setSaving(true);
    try {
      await setNarration(lecture.id, {
        narrationMode: next.narrationMode ?? mode,
        narrationAutoAdvance: next.narrationAutoAdvance ?? autoAdvance,
        narrationRequireFull: next.narrationRequireFull ?? requireFull,
        fullNarrationAssetId: next.fullNarrationAssetId ?? lecture.fullNarrationAsset?.id ?? null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleFullUpload(file: File) {
    setUploadingFull(true);
    try {
      const asset = await uploadFile(file, "audio");
      await save({ narrationMode: "FULL_LECTURE", fullNarrationAssetId: asset.id });
      setMode("FULL_LECTURE");
    } finally {
      setUploadingFull(false);
    }
  }

  const MODES: { id: typeof mode; label: string; meta: string }[] = [
    { id: "NONE", label: "No narration", meta: "Slides or video only. No audio player is shown to candidates." },
    { id: "PER_SLIDE", label: "Narration per slide", meta: "A separate recording for each slide, with optional auto-advance." },
    { id: "FULL_LECTURE", label: "One track for the whole lecture", meta: "A single continuous recording that plays across all slides." },
  ];

  return (
    <div className="rounded-md border border-divider bg-neutral-100 p-4">
      <div className="mb-3 font-heading text-[13.5px] font-semibold">Voiceover narration</div>
      <div className="flex flex-col gap-[7px]">
        {MODES.map((m) => (
          <label
            key={m.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-md px-3 py-2.5"
            style={{
              background: mode === m.id ? "var(--color-accent-100)" : "var(--color-bg)",
              border: `1.5px solid ${mode === m.id ? "var(--color-accent)" : "var(--color-neutral-300)"}`,
            }}
          >
            <input
              type="radio"
              name="narr-mode"
              checked={mode === m.id}
              onChange={() => {
                setMode(m.id);
                save({ narrationMode: m.id, narrationAutoAdvance: m.id === "FULL_LECTURE" ? false : autoAdvance });
              }}
              className="mt-0.5 h-[15px] w-[15px] flex-none accent-accent"
            />
            <div>
              <div className="text-[13px] font-medium">{m.label}</div>
              <div className="text-[11.5px] text-neutral-600">{m.meta}</div>
            </div>
          </label>
        ))}
      </div>

      {mode === "PER_SLIDE" && (
        <div className="mt-4 flex flex-col gap-2.5 border-t border-dashed border-neutral-300 pt-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => {
                setAutoAdvance(e.target.checked);
                save({ narrationAutoAdvance: e.target.checked });
              }}
              className="mt-0.5 h-4 w-4 flex-none accent-accent"
            />
            <div className="text-[13px] font-medium">Advance to the next slide when narration ends</div>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={requireFull}
              onChange={(e) => {
                setRequireFull(e.target.checked);
                save({ narrationRequireFull: e.target.checked });
              }}
              className="mt-0.5 h-4 w-4 flex-none accent-accent"
            />
            <div className="text-[13px] font-medium">Require each slide&rsquo;s narration to finish before it counts as complete</div>
          </label>
          <SlideNarrationList lecture={lecture} onSaved={onSaved} />
        </div>
      )}

      {mode === "FULL_LECTURE" && (
        <div className="mt-4 flex items-center gap-3 border-t border-dashed border-neutral-300 pt-3">
          {lecture.fullNarrationAsset ? (
            <div className="text-xs text-neutral-700">
              {lecture.fullNarrationAsset.originalFilename} ·{" "}
              {lecture.fullNarrationAsset.durationSeconds ? fmt(lecture.fullNarrationAsset.durationSeconds) : "Duration pending"}
            </div>
          ) : (
            <div className="text-xs text-neutral-500">No file uploaded yet.</div>
          )}
          <label className="cursor-pointer text-xs font-medium text-accent">
            {uploadingFull ? "Uploading…" : lecture.fullNarrationAsset ? "Replace" : "Upload"}
            <input
              type="file"
              accept="audio/*"
              hidden
              disabled={uploadingFull}
              onChange={(e) => e.target.files?.[0] && handleFullUpload(e.target.files[0])}
            />
          </label>
        </div>
      )}
      {saving && <div className="mt-2 text-[11px] text-neutral-500">Saving…</div>}
    </div>
  );
}

function SlideNarrationList({ lecture, onSaved }: { lecture: LectureData; onSaved: () => void }) {
  const [busySlideId, setBusySlideId] = React.useState<string | null>(null);

  async function handleAddSlide() {
    await addSlide(lecture.id, { title: `Slide ${lecture.slides.length + 1}` });
    onSaved();
  }

  async function moveSlide(slideId: string, dir: -1 | 1) {
    const ordered = [...lecture.slides].sort((a, b) => a.orderIndex - b.orderIndex).map((s) => s.id);
    const idx = ordered.indexOf(slideId);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    [ordered[idx], ordered[swapWith]] = [ordered[swapWith]!, ordered[idx]!];
    await reorderSlides(lecture.id, ordered);
    onSaved();
  }

  async function handleUpload(slideId: string, file: File) {
    setBusySlideId(slideId);
    try {
      const asset = await uploadFile(file, "audio");
      await updateSlide(slideId, { narrationAssetId: asset.id });
      onSaved();
    } finally {
      setBusySlideId(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between text-[10.5px] tracking-[0.1em] text-neutral-500 uppercase">
        <span>Narration per slide</span>
        <span>{lecture.slides.filter((s) => s.narrationAsset).length} of {lecture.slides.length} recorded</span>
      </div>
      <div className="overflow-hidden rounded-md border border-divider bg-bg">
        {lecture.slides.length === 0 && (
          <div className="p-3 text-center text-xs text-neutral-500">No slides yet.</div>
        )}
        {lecture.slides.map((slide, i) => (
          <div key={slide.id} className="flex items-center gap-3 border-b border-dashed border-neutral-300 px-3 py-2 last:border-b-0">
            <span className="flex flex-none flex-col gap-0.5">
              <button onClick={() => moveSlide(slide.id, -1)} className="text-[9px] text-neutral-500" aria-label="Move up">
                ▲
              </button>
              <button onClick={() => moveSlide(slide.id, 1)} className="text-[9px] text-neutral-500" aria-label="Move down">
                ▼
              </button>
            </span>
            <span className="w-14 flex-none text-[11.5px] text-neutral-500">Slide {i + 1}</span>
            <span className="flex-1 truncate text-[12.5px]">{slide.title || "Untitled"}</span>
            <span className="w-12 flex-none text-right text-[11.5px] text-neutral-500">
              {slide.narrationAsset?.durationSeconds ? fmt(slide.narrationAsset.durationSeconds) : "—"}
            </span>
            <label className="flex-none cursor-pointer text-[11.5px] font-medium text-accent">
              {busySlideId === slide.id ? "Uploading…" : slide.narrationAsset ? "Replace" : "Upload"}
              <input
                type="file"
                accept="audio/*"
                hidden
                disabled={busySlideId === slide.id}
                onChange={(e) => e.target.files?.[0] && handleUpload(slide.id, e.target.files[0])}
              />
            </label>
            <button
              onClick={async () => {
                await deleteSlide(slide.id);
                onSaved();
              }}
              className="flex-none text-[11.5px] text-neutral-500"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <Button variant="secondary" onClick={handleAddSlide} className="mt-2 px-[11px] py-[5px] text-xs">
        + Add slide
      </Button>
    </div>
  );
}

function ScenarioTab({ lecture, onSaved }: { lecture: LectureData; onSaved: () => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-neutral-700">Practical scenario shown to candidates</label>
      <textarea
        defaultValue={lecture.scenarioPrompt ?? ""}
        rows={6}
        onBlur={(e) => updateLecture(lecture.id, { scenarioPrompt: e.target.value }).then(onSaved)}
        className="w-full rounded-md border border-neutral-300 bg-bg px-3 py-2 text-sm"
      />
    </div>
  );
}

function DraftingTab({ lecture, onSaved }: { lecture: LectureData; onSaved: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-neutral-700">Exercise prompt</label>
        <textarea
          defaultValue={lecture.draftingPrompt ?? ""}
          rows={3}
          onBlur={(e) => updateLecture(lecture.id, { draftingPrompt: e.target.value }).then(onSaved)}
          className="w-full rounded-md border border-neutral-300 bg-bg px-3 py-2 text-sm"
        />
      </div>
      <div className="w-40">
        <label className="mb-1.5 block text-xs font-medium text-neutral-700">Word limit</label>
        <input
          type="number"
          defaultValue={lecture.draftingWordLimit ?? undefined}
          onBlur={(e) =>
            updateLecture(lecture.id, { draftingWordLimit: e.target.value ? Number(e.target.value) : undefined }).then(onSaved)
          }
          className="h-9 w-full rounded-md border border-neutral-300 bg-bg px-2.5 text-sm"
        />
      </div>
    </div>
  );
}

// ── Module quiz editor ──

function ModuleQuizEditor({ mod, onSaved }: { mod: ModuleData; onSaved: () => void }) {
  const [questions, setQuestions] = React.useState<QuizQuestionData[]>(mod.quiz?.questions ?? []);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      {
        id: `new-${Date.now()}`,
        orderIndex: qs.length,
        prompt: "",
        marks: 1,
        explanation: "",
        options: [
          { id: `new-${Date.now()}-a`, orderIndex: 0, text: "", isCorrect: true },
          { id: `new-${Date.now()}-b`, orderIndex: 1, text: "", isCorrect: false },
        ],
      },
    ]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await upsertQuiz(mod.id, {
        passMarkPercent: mod.quiz?.passMarkPercent ?? 60,
        questions: questions.map((q) => ({
          prompt: q.prompt,
          marks: q.marks,
          explanation: q.explanation || undefined,
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        })),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-divider p-3">
      <div className="mb-2 text-[12.5px] text-neutral-600">Objective questions · pass mark {mod.quiz?.passMarkPercent ?? 60}%</div>
      {error && <div className="mb-2 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-2.5 py-1.5 text-xs text-[#912019]">{error}</div>}
      <div className="flex flex-col gap-2">
        {questions.map((q, qi) => (
          <div key={q.id} className="rounded-md border border-divider p-2.5">
            <input
              value={q.prompt}
              placeholder="Question prompt"
              onChange={(e) =>
                setQuestions((qs) => qs.map((qq, i) => (i === qi ? { ...qq, prompt: e.target.value } : qq)))
              }
              className="mb-2 h-8 w-full rounded border border-neutral-300 px-2 text-[13px]"
            />
            {q.options.map((o, oi) => (
              <div key={o.id} className="mb-1 flex items-center gap-2">
                <input
                  type="radio"
                  checked={o.isCorrect}
                  onChange={() =>
                    setQuestions((qs) =>
                      qs.map((qq, i) =>
                        i === qi ? { ...qq, options: qq.options.map((oo, j) => ({ ...oo, isCorrect: j === oi })) } : qq
                      )
                    )
                  }
                  className="h-3.5 w-3.5 flex-none accent-accent"
                />
                <input
                  value={o.text}
                  placeholder="Option text"
                  onChange={(e) =>
                    setQuestions((qs) =>
                      qs.map((qq, i) =>
                        i === qi
                          ? { ...qq, options: qq.options.map((oo, j) => (j === oi ? { ...oo, text: e.target.value } : oo)) }
                          : qq
                      )
                    )
                  }
                  className="h-7 flex-1 rounded border border-neutral-300 px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((qs) =>
                      qs.map((qq, i) => {
                        if (i !== qi || qq.options.length <= 2) return qq;
                        const remaining = qq.options.filter((_, j) => j !== oi);
                        // Removing the correct option would leave none marked — fall back to the first remaining one.
                        if (!remaining.some((oo) => oo.isCorrect)) remaining[0] = { ...remaining[0], isCorrect: true };
                        return { ...qq, options: remaining };
                      })
                    )
                  }
                  disabled={q.options.length <= 2}
                  title={q.options.length <= 2 ? "A question needs at least two options" : "Remove option"}
                  className="h-6 w-6 flex-none rounded text-neutral-500 hover:bg-neutral-100 hover:text-[#912019] disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setQuestions((qs) =>
                  qs.map((qq, i) =>
                    i === qi
                      ? {
                          ...qq,
                          options: [
                            ...qq.options,
                            { id: `new-${Date.now()}-${qq.options.length}`, orderIndex: qq.options.length, text: "", isCorrect: false },
                          ],
                        }
                      : qq
                  )
                )
              }
              className="mt-1 cursor-pointer text-[11.5px] font-medium text-accent"
            >
              + Add option
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" onClick={addQuestion} className="px-[11px] py-[5px] text-xs">
          + Add question
        </Button>
        <Button onClick={save} disabled={saving} className="px-[11px] py-[5px] text-xs">
          {saving ? "Saving…" : "Save quiz"}
        </Button>
      </div>
    </div>
  );
}
