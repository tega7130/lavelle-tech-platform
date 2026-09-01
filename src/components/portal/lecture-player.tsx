"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { LectureStateDot } from "@/components/portal/lecture-state-dot";
import { QuizPlayer } from "@/components/portal/quiz-player";
import { LectureNotesPanel } from "@/components/portal/lecture-notes-panel";
import { ChevronLeftIcon, LockIcon, MenuIcon } from "@/components/icons";
import { computePercent } from "@/lib/progress";
import { renderMarkupToReact } from "@/lib/rich-text";
import { youtubeEmbedUrl } from "@/lib/format";
import { loadYouTubeIframeApi, type YouTubePlayer } from "@/lib/youtube-player";
import type { LectureStep } from "@/lib/lecture-steps";
import { completeStepAction, submitDraftingAction, completeProgrammeAction } from "@/app/actions/player";
import type { getLecturePlayer } from "@/lib/player-reads";

function fireConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors: ["#B45309", "#15803d", "#0b1322"] });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors: ["#B45309", "#15803d", "#0b1322"] });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ["#B45309", "#15803d", "#0b1322"] });
}

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
  const { lecture, module: mod, steps, quiz, quizAttempt, resumePosition, nextLectureId, isLastLectureInProgramme, modules } = data;

  const firstIncomplete = steps.findIndex((s) => !data.stepsCompleted.includes(s));
  const [stepIndex, setStepIndex] = React.useState(firstIncomplete === -1 ? steps.length - 1 : firstIncomplete);
  const [completed, setCompleted] = React.useState<Set<string>>(new Set(data.stepsCompleted));
  const activeStep = steps[stepIndex]!;
  // Mobile-only drawer for the module/lecture rail — desktop keeps it as a
  // permanently visible column (see the `md:` split in the JSX below).
  const [railOpen, setRailOpen] = React.useState(false);

  // ── Media state ──
  const [slideIndex, setSlideIndex] = React.useState(resumePosition.slideIndex);
  const [mediaBuffering, setMediaBuffering] = React.useState(lecture.mediaKind === "VIDEO");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const narrationRef = React.useRef<HTMLAudioElement>(null);
  const [narrationPlayed, setNarrationPlayed] = React.useState(false);

  const currentSlide = lecture.slides[slideIndex];
  // A pasted link (YouTube etc.) plays as an iframe embed, not a raw
  // <video> src — a YouTube watch/embed URL has no video bytes to stream.
  // Uploaded assets never resolve here (embedUrl stays null) since
  // lecture.videoUrl is only ever the signed asset URL or a pasted link.
  const embedUrl = lecture.videoUrl ? youtubeEmbedUrl(lecture.videoUrl) : null;
  const youtubePlayerElementId = `youtube-player-${lecture.id}`;

  // ── Position autosave — throttled to ~10s and on unload, never per interaction ──
  // mediaDurationSeconds rides along on the same payload, for watch-time
  // analytics (recordVideoWatchProgress) — see the route handler.
  const positionRef = React.useRef<{ slideIndex: number; mediaPositionSeconds: number; mediaDurationSeconds?: number }>({
    slideIndex: resumePosition.slideIndex,
    mediaPositionSeconds: resumePosition.mediaPositionSeconds,
  });
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

  // A YouTube embed has no timeupdate event of its own — the IFrame
  // Player API is the only way to read its position/duration. Polled (not
  // event-driven) while playing, at the same cadence savePosition already
  // throttles to, so this never adds extra network chatter of its own —
  // it only ever updates positionRef, which the existing interval reports.
  React.useEffect(() => {
    if (!embedUrl) return;
    let destroyed = false;
    let player: YouTubePlayer | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    loadYouTubeIframeApi().then((YT) => {
      if (destroyed) return;
      player = new YT.Player(youtubePlayerElementId, {
        events: {
          onStateChange: (event) => {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            if (event.data === YT.PlayerState.PLAYING) {
              pollInterval = setInterval(() => {
                const p = event.target;
                positionRef.current.mediaPositionSeconds = Math.floor(p.getCurrentTime());
                const duration = p.getDuration();
                if (Number.isFinite(duration) && duration > 0) positionRef.current.mediaDurationSeconds = Math.floor(duration);
              }, 3000);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (pollInterval) clearInterval(pollInterval);
      player?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedUrl, youtubePlayerElementId]);

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

  const moduleIndex = modules.findIndex((m) => m.id === mod.id) + 1;
  // nextLectureId already flattens across module boundaries (see
  // getLecturePlayer) — comparing its module to the current one is how we
  // tell "advance within this module" apart from "advance to the next
  // module" for the bottom-nav CTA label below.
  const nextLectureModule = nextLectureId ? modules.find((m) => m.lectures.some((l) => l.id === nextLectureId)) : null;
  const nextLectureCrossesModule = !!nextLectureModule && nextLectureModule.id !== mod.id;

  const draftingComplete = completed.has("drafting");
  const isCurrentStepBlocking =
    (activeStep === "drafting" && !draftingComplete) || (activeStep === "scenario" && !completed.has("scenario"));

  // ── Programme completion ──
  // A module quiz gates progression on being PASSED, not merely submitted —
  // "quiz" is only ever added to `completed` (below, via markStepComplete)
  // when the attempt passes, so a failed/un-taken quiz blocks "Next module"
  // and "Complete Programme" until the candidate passes it.
  const [quizPassed, setQuizPassed] = React.useState(quizAttempt?.passed === true);
  // Gated on every authored step of THIS lecture being done, not merely
  // stepIndex reaching the last page — reaching the quiz page doesn't mean
  // the quiz was submitted (QuizPlayer marks "quiz" complete on a PASS only).
  const lectureFullyComplete = steps.every((s) => completed.has(s));
  // A quiz that was already passed in an earlier session (data.stepsCompleted)
  // stays "complete" while the candidate retakes it — quizResultVisible tracks
  // whether the CURRENT attempt has a result on screen, so the finishing CTA
  // doesn't appear mid-retake, before "Submit quiz" is clicked (rule from
  // candidate report: button must not show while the quiz form is still up).
  const [quizResultVisible, setQuizResultVisible] = React.useState(completed.has("quiz"));
  const readyToFinish = lectureFullyComplete && (!steps.includes("quiz") || (quizResultVisible && quizPassed));
  // Every module that carries a quiz must have that quiz passed before the
  // programme can be marked complete — checking only the current lecture
  // isn't enough, since a candidate could reach the final lecture while an
  // earlier module's quiz was never passed. Other modules read
  // `m.quizPassed`, which is derived server-side from QuizAttempt.passed
  // (keyed by quizId), NOT from a lecture's stepsCompleted — that flag is
  // recorded against whichever lecture was the module's last PUBLISHED one
  // at attempt time, and staff unpublishing/reordering lectures afterwards
  // shifts which lecture is "last" without moving the flag, which used to
  // make a real pass silently invisible here. The current module still
  // reads from live local state (quizPassed) rather than the server-fetched
  // `modules` snapshot, which can briefly lag one refresh behind right
  // after a submit.
  const allModuleQuizzesPassed = modules.every((m) => {
    const lastLecture = m.lectures[m.lectures.length - 1];
    if (!lastLecture || !lastLecture.steps.includes("quiz")) return true;
    if (m.id === mod.id) return quizPassed;
    return m.quizPassed;
  });
  const [completingProgramme, setCompletingProgramme] = React.useState(false);
  const [completeError, setCompleteError] = React.useState<string | null>(null);
  const [completionModal, setCompletionModal] = React.useState<{ certificateNumber: string | null } | null>(null);

  async function handleCompleteProgramme() {
    setCompletingProgramme(true);
    setCompleteError(null);
    try {
      const result = await completeProgrammeAction(enrolmentId);
      fireConfetti();
      setCompletionModal(result);
      router.refresh();
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setCompletingProgramme(false);
    }
  }

  // Shared between the permanent desktop column and the mobile drawer —
  // onLinkClick dismisses the drawer, wired up only for the mobile variant.
  function renderRailContent(onLinkClick?: () => void) {
    return (
      <>
        <div className="p-[var(--space-4)] border-b border-white/10">
          <Link
            href={`/portal/programme?programme=${data.programme.code}`}
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-[13px]"
          >
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
                    onClick={onLinkClick}
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
      </>
    );
  }

  return (
    <div className="min-h-screen bg-bg grid grid-cols-1 md:grid-cols-[300px_1fr]">
      {/* Dark lecture rail — permanent column on desktop, drawer on mobile */}
      <aside className="hidden md:flex text-white flex-col" style={{ background: "#0b1322" }}>
        {renderRailContent()}
      </aside>

      {/* Mobile-only top bar: back link, progress, and a toggle for the rail drawer */}
      <div className="md:hidden flex items-center justify-between gap-3 px-[var(--space-4)] py-3 text-white" style={{ background: "#0b1322" }}>
        <Link
          href={`/portal/programme?programme=${data.programme.code}`}
          className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-[13px] flex-none"
        >
          <ChevronLeftIcon width={14} height={14} /> Back
        </Link>
        <span className="text-accent-2 text-[12px] font-semibold flex-1 text-center truncate">{percent}% complete</span>
        <button
          onClick={() => setRailOpen(true)}
          aria-label="Open module navigation"
          title="Open module navigation"
          className="flex-none w-[34px] h-[34px] rounded-md border border-white/20 text-white flex items-center justify-center hover:bg-white/10 cursor-pointer"
        >
          <MenuIcon />
        </button>
      </div>

      {railOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex md:hidden bg-[rgba(19,26,46,0.55)]" onClick={() => setRailOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-[280px] max-w-[84vw] h-full flex flex-col text-white overflow-y-auto"
              style={{ background: "#0b1322" }}
            >
              {renderRailContent(() => setRailOpen(false))}
            </div>
          </div>,
          document.body
        )}

      {/* Content */}
      <main className="flex flex-col p-[var(--space-4)] md:p-[var(--space-6)] max-w-[720px] mx-auto w-full">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            Week {mod.weekNumber} &middot; {mod.title}
          </span>
          <span className="text-[11px] text-neutral-500 font-semibold">
            Module {moduleIndex} of {modules.length}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          {modules.map((m) => (
            <div
              key={m.id}
              className={`h-1.5 flex-1 rounded-full ${
                m.percent === 100 ? "bg-accent-2" : m.id === mod.id ? "bg-accent" : "bg-neutral-200"
              }`}
              title={m.title}
            />
          ))}
        </div>
        <h1 className="font-heading text-2xl m-0 mt-3">{lecture.title}</h1>

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
                {embedUrl ? (
                  <iframe
                    id={youtubePlayerElementId}
                    src={embedUrl}
                    title={`${mod.title} — ${lecture.title}`}
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
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
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration;
                        if (Number.isFinite(d) && d > 0) positionRef.current.mediaDurationSeconds = Math.floor(d);
                      }}
                      onEnded={() => markStepComplete("content")}
                    />
                  </>
                )}
              </div>
            ) : null}
            {lecture.mediaKind === "VIDEO" && embedUrl && (
              // A YouTube embed can't report "ended" back to us (no player
              // API wired up here) — the candidate confirms manually,
              // same manual-complete pattern as the scenario step below.
              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1 text-[12px] text-neutral-600">Done watching? Click 'Mark as watched' below, then 'Next' to continue.</div>
                <Button onClick={() => markStepComplete("content")} disabled={completed.has("content")} className="flex-shrink-0">
                  {completed.has("content") ? "Marked as watched" : "Mark as watched"}
                </Button>
              </div>
            )}
            {lecture.mediaKind !== "VIDEO" && (
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
                    disabled={lecture.narrationRequireFull && !!currentSlide?.narrationUrl && !narrationPlayed}
                    onClick={() => {
                      setNarrationPlayed(false);
                      if (slideIndex < lecture.slides.length - 1) setSlideIndex((i) => i + 1);
                      else markStepComplete("content");
                    }}
                  >
                    {slideIndex < lecture.slides.length - 1 ? "Next slide" : "Finish content"}
                  </Button>
                </div>
              </div>
            )}
            <LectureNotesPanel enrolmentId={enrolmentId} lectureId={lecture.id} initialBody={data.lectureNote?.body ?? ""} />
          </div>
        )}

        {activeStep === "scenario" && (
          <div>
            <div className="text-[14px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
              {renderMarkupToReact(lecture.scenarioPrompt ?? "")}
            </div>
            {lecture.scenarioGuidance && (
              <div className="mt-2 text-[13px] text-neutral-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
                {renderMarkupToReact(lecture.scenarioGuidance)}
              </div>
            )}
            {!completed.has("scenario") && (
              <Button className="mt-4" onClick={() => markStepComplete("scenario")}>
                Continue
              </Button>
            )}
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
          <QuizPlayer
            enrolmentId={enrolmentId}
            quizId={quiz.quizId}
            onAttemptStart={() => setQuizResultVisible(false)}
            onCompleted={(passed) => {
              setQuizPassed(passed);
              if (passed) markStepComplete("quiz");
              setQuizResultVisible(true);
            }}
          />
        )}
        {activeStep === "quiz" && !quiz && (
          <div className="text-[13px] text-neutral-500">No quiz is available for this module yet.</div>
        )}

        {/* Bottom nav */}
        <div className="flex flex-col items-end gap-2 mt-[var(--space-6)] pt-[var(--space-4)] border-t border-divider">
          <div className="w-full flex items-center justify-between">
            <Button variant="secondary" onClick={goPrevStep} disabled={stepIndex === 0}>
              Previous
            </Button>
            {stepIndex < steps.length - 1 ? (
              <Button onClick={goNextStep} disabled={isCurrentStepBlocking}>
                Next
              </Button>
            ) : isLastLectureInProgramme ? (
              readyToFinish && allModuleQuizzesPassed ? (
                <Button onClick={handleCompleteProgramme} disabled={completingProgramme}>
                  {completingProgramme ? "Completing…" : "Complete Programme"}
                </Button>
              ) : null
            ) : readyToFinish && nextLectureId ? (
              // The quiz result (if any) stays on screen until the candidate
              // clicks through — this doesn't auto-advance, it just points
              // at wherever nextLectureId actually is, in or out of module.
              <Link href={`/learn/${enrolmentId}/${nextLectureId}`} className="inline-flex">
                <Button>{nextLectureCrossesModule ? "Next module →" : "Complete Lecture →"}</Button>
              </Link>
            ) : readyToFinish ? (
              <LockIcon width={14} height={14} className="text-neutral-400" />
            ) : null}
          </div>
          {completeError && <div className="text-[12px] text-[#b91c1c]">{completeError}</div>}
        </div>
      </main>

      <Dialog
        open={!!completionModal}
        onClose={() => setCompletionModal(null)}
        title="🎉 Programme complete!"
        actions={
          completionModal?.certificateNumber ? (
            <Link href={`/portal/credentials/${completionModal.certificateNumber}`} className="inline-flex">
              <Button>View your certificate</Button>
            </Link>
          ) : (
            <Link href="/portal/credentials" className="inline-flex">
              <Button variant="secondary">Go to Credentials</Button>
            </Link>
          )
        }
      >
        {completionModal?.certificateNumber ? (
          <p>
            Congratulations — you passed <strong>{data.programme.title}</strong>. Your certificate is ready to view
            and download.
          </p>
        ) : data.hasExam ? (
          <p>
            Nice work finishing every lecture in <strong>{data.programme.title}</strong>. Your final result depends
            on your examination — we&rsquo;ll notify you the moment your certificate is ready under Credentials.
          </p>
        ) : (
          <p>
            You&rsquo;ve finished every lecture in <strong>{data.programme.title}</strong>, but at least one module
            quiz hasn&rsquo;t been passed yet. Retake it from the module and your certificate will be issued the
            moment you pass.
          </p>
        )}
      </Dialog>
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
      <div className="text-[14px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
        {renderMarkupToReact(prompt)}
      </div>
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
