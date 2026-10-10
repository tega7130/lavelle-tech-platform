"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "@/components/icons";

export interface SlidePlayerSlide {
  id: string;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  imageMimeType: string | null;
  narrationUrl: string | null;
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Minimal, locked-down player for PER_SLIDE (and NONE) narration lectures —
 * just the slide and Previous / Play-Pause / Next. No scrubber, volume, or
 * fullscreen, and nothing to download: a PDF slide's native browser toolbar
 * (menu, zoom, print, download) is suppressed via the #toolbar=0 URL
 * fragment — a fragment never reaches the server, so it can't disturb the
 * signed URL's query string/signature.
 * FULL_LECTURE mode is a structurally different interaction (one continuous
 * track, no per-slide sync) and is rendered separately in lecture-player.tsx —
 * this component never sees that mode.
 */
export function SlidePlayer({
  slides,
  slideIndex,
  setSlideIndex,
  autoPlayNarration,
  autoAdvance,
  requireFull,
  narrationPlayed,
  setNarrationPlayed,
  mediaBuffering,
  setMediaBuffering,
  bufferingLabel,
  onFinishContent,
  resumeSlideIndex,
  resumeMediaPositionSeconds,
  onPositionUpdate,
}: {
  slides: SlidePlayerSlide[];
  slideIndex: number;
  setSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  autoPlayNarration: boolean;
  autoAdvance: boolean;
  requireFull: boolean;
  narrationPlayed: boolean;
  setNarrationPlayed: (played: boolean) => void;
  mediaBuffering: boolean;
  setMediaBuffering: (buffering: boolean) => void;
  bufferingLabel: string;
  onFinishContent: () => void;
  /** Where the candidate left off — only the slide they were actually on gets its narration seeked; every other slide starts fresh. */
  resumeSlideIndex: number;
  resumeMediaPositionSeconds: number;
  onPositionUpdate: (seconds: number) => void;
}) {
  const currentSlide = slides[slideIndex];
  const hasNarration = !!currentSlide?.narrationUrl;
  const isLastSlide = slideIndex >= slides.length - 1;
  const nextDisabled = requireFull && hasNarration && !narrationPlayed;

  return (
    <div className="overflow-hidden rounded-md border border-divider bg-neutral-950">
      <div className="relative flex aspect-video items-center justify-center bg-black" onContextMenu={(e) => e.preventDefault()}>
        {mediaBuffering && hasNarration && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 text-center text-[13px] text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent-2" />
            <div className="font-heading font-semibold text-[13.5px] mt-3">{bufferingLabel}</div>
            <div className="mt-1 text-[11.5px] text-white/55">Narration is loading. Your progress is saved.</div>
          </div>
        )}
        {currentSlide?.imageUrl ? (
          currentSlide.imageMimeType === "application/pdf" ? (
            // Slides are converted to images at upload time (see
            // rasterizePdfFirstPage) specifically so a candidate never
            // sees a PDF — this branch should be unreachable, but a
            // calm fallback here is better than silently falling through
            // to an iframe that would re-expose the browser's PDF chrome.
            <div className="px-6 text-center text-[13px] text-white/60">
              This slide can&apos;t be displayed. Contact support if this continues.
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentSlide.imageUrl}
              alt={currentSlide.title ?? ""}
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          )
        ) : (
          <div className="px-6 text-center text-[13px] text-white/60">No slide file uploaded yet.</div>
        )}
      </div>

      {currentSlide && (
        <SlideControlBar
          key={currentSlide.id}
          slide={currentSlide}
          autoPlayNarration={autoPlayNarration}
          autoAdvance={autoAdvance}
          isLastSlide={isLastSlide}
          setMediaBuffering={setMediaBuffering}
          setNarrationPlayed={setNarrationPlayed}
          setSlideIndex={setSlideIndex}
          onFinishContent={onFinishContent}
          resumeSeconds={slideIndex === resumeSlideIndex ? resumeMediaPositionSeconds : 0}
          onPositionUpdate={onPositionUpdate}
        />
      )}

      <div className="flex items-center justify-between border-t border-white/10 bg-neutral-900 px-3 py-2">
        <button
          type="button"
          onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
          disabled={slideIndex === 0}
          aria-label="Previous slide"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-white/70 hover:text-white disabled:opacity-30"
        >
          <ChevronLeftIcon width={13} height={13} />
        </button>
        <span className="text-[12px] text-white/60">
          Slide {slideIndex + 1} of {slides.length || 1}
        </span>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={() => {
            setNarrationPlayed(false);
            if (!isLastSlide) setSlideIndex((i) => i + 1);
            else onFinishContent();
          }}
          aria-label={isLastSlide ? "Finish content" : "Next slide"}
          className="flex h-7 flex-none items-center justify-center rounded-full px-1 text-white/70 hover:text-white disabled:opacity-30"
        >
          {isLastSlide ? <span className="text-[12px] font-medium">Finish content</span> : <ChevronRightIcon width={13} height={13} />}
        </button>
      </div>

      {currentSlide?.title && (
        <div className="bg-bg px-3 py-3">
          <div className="font-heading font-semibold text-[15px]">{currentSlide.title}</div>
          {currentSlide.body && <p className="mt-1.5 text-[13px] text-neutral-700">{currentSlide.body}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Owns the narration <audio> element, keyed by slide id from the parent —
 * remounting per slide gives a fresh isPlaying/audioError state for free,
 * with no reset-on-slide-change effect needed. Renders a disabled,
 * label-only bar when the slide has no narration at all.
 */
function SlideControlBar({
  slide,
  autoPlayNarration,
  autoAdvance,
  isLastSlide,
  setMediaBuffering,
  setNarrationPlayed,
  setSlideIndex,
  onFinishContent,
  resumeSeconds,
  onPositionUpdate,
}: {
  slide: SlidePlayerSlide;
  autoPlayNarration: boolean;
  autoAdvance: boolean;
  isLastSlide: boolean;
  setMediaBuffering: (buffering: boolean) => void;
  setNarrationPlayed: (played: boolean) => void;
  setSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  onFinishContent: () => void;
  resumeSeconds: number;
  onPositionUpdate: (seconds: number) => void;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [audioError, setAudioError] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(resumeSeconds);
  const [duration, setDuration] = React.useState(0);

  if (!slide.narrationUrl) {
    return (
      <div className="flex items-center gap-2.5 bg-neutral-900 px-3 py-2.5">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/15 text-white/30">
          <PlayIcon width={14} height={14} />
        </div>
        <span className="text-[11.5px] text-white/50">No narration for this slide — use Previous/Next to continue.</span>
      </div>
    );
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setAudioError(true));
    else el.pause();
  }

  return (
    <div className="flex items-center gap-2.5 bg-neutral-900 px-3 py-2.5">
      {audioError ? (
        <div className="text-[11.5px] text-[#f2a7a0]">
          This narration isn&apos;t available right now — you can still read this slide and move on.
        </div>
      ) : (
        <>
          <audio
            ref={audioRef}
            src={slide.narrationUrl}
            autoPlay={autoPlayNarration}
            className="hidden"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setMediaBuffering(true)}
            onPlaying={() => setMediaBuffering(false)}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
              onPositionUpdate(e.currentTarget.currentTime);
            }}
            onLoadedMetadata={(e) => {
              if (resumeSeconds > 0) e.currentTarget.currentTime = resumeSeconds;
              setDuration(e.currentTarget.duration);
            }}
            onError={() => {
              setMediaBuffering(false);
              setAudioError(true);
            }}
            onEnded={() => {
              setNarrationPlayed(true);
              if (autoAdvance) {
                if (!isLastSlide) setSlideIndex((i) => i + 1);
                else onFinishContent();
              }
            }}
          />
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-neutral-900"
          >
            {isPlaying ? <PauseIcon width={15} height={15} /> : <PlayIcon width={15} height={15} />}
          </button>
          <span className="w-9 flex-none text-right text-[11px] text-white/60">{fmtTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => {
              const t = Number(e.target.value);
              setCurrentTime(t);
              if (audioRef.current) audioRef.current.currentTime = t;
            }}
            aria-label="Narration progress"
            className="h-1 flex-1 accent-accent-2"
          />
          <span className="w-9 flex-none text-[11px] text-white/60">{fmtTime(duration)}</span>
        </>
      )}
    </div>
  );
}
