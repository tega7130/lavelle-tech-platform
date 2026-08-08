"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { LectureStateDot } from "@/components/portal/lecture-state-dot";
import { QuizPlayer } from "@/components/portal/quiz-player";
import { ChevronLeftIcon, LockIcon } from "@/components/icons";
import { computePercent } from "@/lib/progress";
import type { LectureStep } from "@/lib/lecture-steps";
import { completeStepAction, submitDraftingAction } from "@/app/actions/player";
import type { getLecturePlayer } from "@/lib/player-reads";

type PlayerData = Awaited<ReturnType<typeof getLecturePlayer>>;

const STEP_LABEL: Record<LectureStep, string> = {
  content: "Content",
  scenario: "Scenario",
  drafting: "Drafting",
  quiz: "Quiz",
};

const POSITION_SAVE_INTERVAL_MS = 10_000;

function draftLocalStorageKey(enrolmentId: string, lectureId: string) {
  return `lavelle:draft-offline:${enrolmentId}:${lectureId}`;
}

export function LecturePlayer({ enrolmentId, data }: { enrolmentId: string; data: PlayerData }) {
  const router = useRouter();
  const { lecture, module: mod, steps, quiz, resumePosition, nextLectureId, isLastLectureInProgramme, modules } = data;

  const firstIncomplete = steps.findIndex((s) => !data.stepsCompleted.includes(s));
  const [stepIndex, setStepIndex] = React.useState(firstIncomplete === -1 ? steps.length - 1 : firstIncomplete);
  const [completed, setCompleted] = React.useState<Set<string>>(new Set(data.stepsCompleted));
  const activeStep = steps[stepIndex]!;

  // ── Media state ──
  const [slideIndex, setSlideIndex] = React.useState(resumePosition.slideIndex);
  const [mediaBuffering, setMediaBuffering] = React.useState(lecture.mediaKind === "VIDEO");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const narrationRef = React.useRef<HTMLAudioElement>(null);
  const [narrationPlayed, setNarrationPlayed] = React.useState(false);

  const currentSlide = lecture.slides[slideIndex];

  // ── Position autosave — throttled to ~10s and on unload, never per interaction ──
  const positionRef = React.useRef({ slideIndex: resumePosition.slideIndex, mediaPositionSeconds: resumePosition.mediaPositionSeconds });
  React.useEffect(() => {
    positionRef.current.slideIndex = slideIndex;
  }, [slideIndex]);

  const savePosition = React.useCallback(
    (useBeacon: boolean) => {
      const payload = JSON.stringify({ enrolmentId, lectureId: lecture.id, ...positionRef.current });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/progress/position", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/progress/position", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(
          () => {}
        );
      }
    },
    [enrolmentId, lecture.id]
  );

  React.useEffect(() => {
    const interval = setInterval(() => savePosition(false), POSITION_SAVE_INTERVAL_MS);
    const onHide = () => savePosition(true);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") savePosition(true);
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", onHide);
      savePosition(true);
    };
  }, [savePosition]);

  async function markStepComplete(step: LectureStep) {
    if (completed.has(step)) return;
    setCompleted((prev) => new Set(prev).add(step));
    try {
      await completeStepAction(enrolmentId, lecture.id, step);
      router.refresh();
    } catch {
      // Non-fatal — the rail/overview will simply lag one refresh behind.
    }
  }

  function goNextStep() {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
  }
  function goPrevStep() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  const percent = computePercent(
    modules.reduce((n, m) => n + m.lectures.filter((l) => l.state === "COMPLETED").length, 0),
    modules.reduce((n, m) => n + m.lectures.length, 0)
  );

  const draftingComplete = completed.has("drafting");
  const isCurrentStepBlocking = activeStep === "drafting" && !draftingComplete;

  return (
    <div className="min-h-screen bg-bg grid" style={{ gridTemplateColumns: "300px 1fr" }}>
      {/* Dark lecture rail */}
      <aside className="text-white flex flex-col" style={{ background: "#0b1322" }}>
        <div className="p-[var(--space-4)] border-b border-white/10">
          <Link href="/portal/programme" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-[13px]">
            <ChevronLeftIcon width={14} height={14} /> Back
          </Link>
          <div className="font-heading font-semibold text-[14px] mt-3">{data.programme.title}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-accent-2 text-[12px] font-semibold">{percent}% complete</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-accent-2 rounded-full" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-[var(--space-3)]">
          {modules.map((m) => (
            <div key={m.id} className="mb-4">
              <div className="text-[10px] uppercase tracking-[0.08em] text-white/40 px-2 mb-1">
                Week {m.weekNumber} &middot; {m.title}
              </div>
              {m.lectures.map((lec) => {
                const isNow = lec.id === lecture.id;
                return (
                  <Link
                    key={lec.id}
                    href={lec.isLocked ? "#" : `/learn/${enrolmentId}/${lec.id}`}
                    aria-disabled={lec.isLocked}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] ${
                      lec.isLocked ? "text-white/30 pointer-events-none" : isNow ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5"
                    }`}
                  >
                    <LectureStateDot state={lec.state} isLocked={lec.isLocked} dark />
                    <span className="flex-1 truncate">{lec.title}</span>
                    {isNow && <span className="text-accent-2 text-[10px] font-semibold">Now</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex flex-col p-[var(--space-6)] max-w-[720px] mx-auto w-full">
        <div className="text-[11px] text-neutral-500">
          Week {mod.weekNumber} &middot; {mod.title}
        </div>
        <h1 className="font-heading text-2xl m-0 mt-1">{lecture.title}</h1>

        {/* Step progression */}
        <div className="flex items-center gap-1.5 mt-[var(--space-5)] mb-[var(--space-5)]">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  completed.has(s)
                    ? "bg-accent-2 text-accent-900"
                    : i === stepIndex
                      ? "bg-accent text-white"
                      : "bg-neutral-200 text-neutral-500"
                }`}
                title={STEP_LABEL[s]}
              >
                {completed.has(s) ? "✓" : i + 1}
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-[2px] bg-neutral-200" />}
            </React.Fragment>
          ))}
        </div>
        <div className="text-[12px] text-neutral-500 -mt-3 mb-4">{STEP_LABEL[activeStep]}</div>

        {activeStep === "content" && (
          <div>
            {lecture.mediaKind === "VIDEO" ? (
              <div className="relative rounded-md overflow-hidden bg-black">
                {mediaBuffering && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/70 text-[13px] z-10">
                    <div>Preparing {mod.title}, {lecture.title}</div>
                    <div className="text-white/60 text-[11px] mt-1">Video is loading. Your progress is saved.</div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  src={lecture.videoUrl ?? undefined}
                  controls
                  className="w-full aspect-video"
                  onCanPlay={() => setMediaBuffering(false)}
                  onWaiting={() => setMediaBuffering(true)}
                  onPlaying={() => setMediaBuffering(false)}
                  onTimeUpdate={(e) => {
                    positionRef.current.mediaPositionSeconds = Math.floor(e.currentTarget.currentTime);
                  }}
                  onEnded={() => markStepComplete("content")}
                />
              </div>
            ) : (
              <div>
                {mediaBuffering && currentSlide?.narrationUrl && (
                  <div className="rounded-md p-[var(--space-6)] text-center mb-3" style={{ background: "#0b1020" }}>
                    <div className="w-8 h-8 mx-auto rounded-full border-2 border-white/15 border-t-accent-2 animate-spin" />
                    <div className="font-heading font-semibold text-[13.5px] text-white mt-3">
                      Preparing {mod.title}, {lecture.title}
                    </div>
                    <div className="text-[11.5px] text-white/55 mt-1">Narration is loading. Your progress is saved.</div>
                  </div>
                )}
                {currentSlide?.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSlide.imageUrl} alt={currentSlide.title ?? ""} className="w-full rounded-md" />
                )}
                {currentSlide?.title && <div className="font-heading font-semibold text-[15px] mt-3">{currentSlide.title}</div>}
                {currentSlide?.body && <p className="text-[13px] text-neutral-700 mt-1.5">{currentSlide.body}</p>}
                {currentSlide?.narrationUrl && (
                  <audio
                    key={currentSlide.id}
                    ref={narrationRef}
                    src={currentSlide.narrationUrl}
                    controls
                    autoPlay={lecture.narrationMode === "PER_SLIDE"}
                    className="w-full mt-3"
                    onWaiting={() => setMediaBuffering(true)}
                    onPlaying={() => setMediaBuffering(false)}
                    onEnded={() => {
                      setNarrationPlayed(true);
                      if (lecture.narrationMode === "PER_SLIDE" && lecture.narrationAutoAdvance) {
                        if (slideIndex < lecture.slides.length - 1) setSlideIndex((i) => i + 1);
                        else markStepComplete("content");
                      }
                    }}
                  />
                )}
                {lecture.narrationMode === "FULL_LECTURE" && lecture.fullNarrationUrl && slideIndex === 0 && (
                  <audio src={lecture.fullNarrationUrl} controls className="w-full mt-3" />
                )}
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                    disabled={slideIndex === 0}
                  >
                    Previous slide
                  </Button>
                  <span className="text-[12px] text-neutral-500">
                    Slide {slideIndex + 1} of {lecture.slides.length || 1}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={
                      slideIndex >= lecture.slides.length - 1 ||
                      (lecture.narrationRequireFull && !!currentSlide?.narrationUrl && !narrationPlayed)
                    }
                    onClick={() => {
                      setNarrationPlayed(false);
                      if (slideIndex < lecture.slides.length - 1) setSlideIndex((i) => i + 1);
                      else markStepComplete("content");
                    }}
                  >
                    Next slide
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeStep === "scenario" && (
          <div>
            <p className="text-[14px] leading-relaxed">{lecture.scenarioPrompt}</p>
            {lecture.scenarioGuidance && <p className="text-[13px] text-neutral-600">{lecture.scenarioGuidance}</p>}
          </div>
        )}

        {activeStep === "drafting" && (
          <DraftingStep
            enrolmentId={enrolmentId}
            lectureId={lecture.id}
            prompt={lecture.draftingPrompt ?? ""}
            wordLimit={lecture.draftingWordLimit}
            initial={data.draftingSubmission}
            onSubmitted={() => markStepComplete("drafting")}
          />
        )}

        {activeStep === "quiz" && quiz && (
          <QuizPlayer enrolmentId={enrolmentId} quizId={quiz.quizId} onCompleted={() => markStepComplete("quiz")} />
        )}
        {activeStep === "quiz" && !quiz && (
          <div className="text-[13px] text-neutral-500">No quiz is available for this module yet.</div>
        )}

        {/* Bottom nav */}
        <div className="flex items-center justify-between mt-[var(--space-6)] pt-[var(--space-4)] border-t border-divider">
          <Button variant="secondary" onClick={goPrevStep} disabled={stepIndex === 0}>
            Previous
          </Button>
          {stepIndex < steps.length - 1 ? (
            <Button onClick={goNextStep} disabled={isCurrentStepBlocking}>
              Next
            </Button>
          ) : isLastLectureInProgramme ? (
            <Tag variant="success">Programme complete — nice work</Tag>
          ) : nextLectureId ? (
            <Link href={`/learn/${enrolmentId}/${nextLectureId}`} className="inline-flex">
              <Button>Next lecture →</Button>
            </Link>
          ) : (
            <LockIcon width={14} height={14} className="text-neutral-400" />
          )}
        </div>
      </main>
    </div>
  );
}

function DraftingStep({
  enrolmentId,
  lectureId,
  prompt,
  wordLimit,
  initial,
  onSubmitted,
}: {
  enrolmentId: string;
  lectureId: string;
  prompt: string;
  wordLimit: number | null;
  initial: PlayerData["draftingSubmission"];
  onSubmitted: () => void;
}) {
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [submitted, setSubmitted] = React.useState(initial?.state === "SUBMITTED");
  const [offlineNotice, setOfflineNotice] = React.useState<{ savedAt: string; words: number } | null>(null);
  const [backOnline, setBackOnline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordCount = body.trim().length === 0 ? 0 : body.trim().split(/\s+/).length;

  const storageKey = draftLocalStorageKey(enrolmentId, lectureId);

  const autosave = React.useCallback(
    async (text: string) => {
      try {
        await fetch("/api/progress/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrolmentId, lectureId, body: text }),
        });
        localStorage.removeItem(storageKey);
      } catch {
        localStorage.setItem(storageKey, JSON.stringify({ body: text, savedAt: new Date().toISOString() }));
      }
    },
    [enrolmentId, lectureId, storageKey]
  );

  function onChange(text: string) {
    setBody(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => autosave(text), 1500);
  }

  React.useEffect(() => {
    function onOnline() {
      const pending = localStorage.getItem(storageKey);
      if (pending) {
        autosave(JSON.parse(pending).body);
        setBackOnline(true);
        setOfflineNotice(null);
      }
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [autosave, storageKey]);

  async function submit() {
    setBusy(true);
    try {
      await autosave(body);
      await submitDraftingAction(enrolmentId, lectureId);
      setSubmitted(true);
      onSubmitted();
    } catch {
      localStorage.setItem(storageKey, JSON.stringify({ body, savedAt: new Date().toISOString() }));
      setOfflineNotice({ savedAt: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), words: wordCount });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[14px] leading-relaxed">{prompt}</p>
      {backOnline && (
        <div className="p-3 rounded-md bg-[#e7f6ed] border border-[#bfe3cd] text-[#15803d] text-[12.5px] mb-3">
          <div className="font-semibold">You are back online</div>
          Your connection has returned and everything held on this device has been sent. Your drafting exercise was
          submitted and is now in the marking queue.
        </div>
      )}
      {offlineNotice && (
        <div className="p-3 rounded-md bg-[#fff7e6] border border-[#f0d9a8] text-[#8a6013] text-[12.5px] mb-3">
          <div className="font-semibold">That could not be sent while you are offline</div>
          Your drafting exercise has been kept on this device exactly as you wrote it. Nothing is lost. It will be
          submitted automatically once you are back online, or you can retry then.
          <div className="mt-1 text-[11px] opacity-80">
            Saved locally {offlineNotice.savedAt} WAT &middot; {offlineNotice.words} words
          </div>
        </div>
      )}
      <Textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        disabled={submitted}
        placeholder="Write your response…"
        className="mt-2"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[12px] text-neutral-500 tabular-nums">
          {wordCount} words{wordLimit ? ` / ${wordLimit} limit` : ""}
        </span>
        {submitted ? (
          <Tag variant="success">Submitted for review</Tag>
        ) : (
          <Button onClick={submit} disabled={busy || wordCount === 0}>
            Submit exercise
          </Button>
        )}
      </div>
    </div>
  );
}
