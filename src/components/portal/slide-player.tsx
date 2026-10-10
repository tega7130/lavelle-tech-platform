"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  VolumeIcon,
} from "@/components/icons";

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
 * Unified video-style player for PER_SLIDE (and NONE) narration lectures —
 * a single frame with the slide as the dominant visual and one control bar,
 * instead of a bare <img> plus a separate native <audio controls> element.
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
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const currentSlide = slides[slideIndex];
  const hasNarration = !!currentSlide?.narrationUrl;
  const isLastSlide = slideIndex >= slides.length - 1;
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement === frameRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else frameRef.current?.requestFullscreen();
  }

  const nextDisabled = requireFull && hasNarration && !narrationPlayed;

  return (
    <div
      ref={frameRef}
      className="overflow-hidden rounded-md border border-divider bg-neutral-950"
      style={isFullscreen ? { display: "flex", flexDirection: "column", height: "100%" } : undefined}
    >
      <div className={`relative flex items-center justify-center bg-black ${isFullscreen ? "flex-1" : "aspect-video"}`}>
        {mediaBuffering && hasNarration && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 text-center text-[13px] text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent-2" />
            <div className="font-heading font-semibold text-[13.5px] mt-3">{bufferingLabel}</div>
            <div className="mt-1 text-[11.5px] text-white/55">Narration is loading. Your progress is saved.</div>
          </div>
        )}
        {currentSlide?.imageUrl ? (
          currentSlide.imageMimeType === "application/pdf" ? (
            <iframe src={currentSlide.imageUrl} title={currentSlide.title ?? "Slide"} className="h-full w-full bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentSlide.imageUrl}
              alt={currentSlide.title ?? ""}
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
        />
      )}

      <div className="flex items-center justify-between border-t border-white/10 bg-neutral-900 px-3 py-2">
        <Button
          variant="ghost"
          onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
          disabled={slideIndex === 0}
          className="!text-white/80 hover:!bg-white/10"
        >
          <ChevronLeftIcon width={12} height={12} /> Previous
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-white/60">
            Slide {slideIndex + 1} of {slides.length || 1}
          </span>
          <button type="button" onClick={toggleFullscreen} aria-label="Fullscreen" className="text-white/70 hover:text-white">
            <FullscreenIcon width={14} height={14} active={isFullscreen} />
          </button>
        </div>
        <Button
          variant="ghost"
          disabled={nextDisabled}
          onClick={() => {
            setNarrationPlayed(false);
            if (!isLastSlide) setSlideIndex((i) => i + 1);
            else onFinishContent();
          }}
          className="!text-white/80 hover:!bg-white/10"
        >
          {isLastSlide ? "Finish content" : "Next"} <ChevronRightIcon width={12} height={12} />
        </Button>
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
 * Owns the narration <audio> element and its playback state, keyed by slide
 * id from the parent — remounting per slide gives fresh isPlaying/currentTime/
 * duration state for free, with no reset-on-slide-change effect needed.
 * Renders a disabled, label-only bar when the slide has no narration at all.
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
}: {
  slide: SlidePlayerSlide;
  autoPlayNarration: boolean;
  autoAdvance: boolean;
  isLastSlide: boolean;
  setMediaBuffering: (buffering: boolean) => void;
  setNarrationPlayed: (played: boolean) => void;
  setSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  onFinishContent: () => void;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [muted, setMuted] = React.useState(false);
  const [audioError, setAudioError] = React.useState(false);

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

  function handleVolumeChange(v: number) {
    setVolume(v);
    setMuted(v === 0);
    if (audioRef.current) audioRef.current.volume = v;
  }

  function toggleMute() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    const effective = nextMuted ? 0 : volume || 1;
    if (audioRef.current) audioRef.current.volume = effective;
  }

  return (
    <div className="flex flex-col gap-2 bg-neutral-900 px-3 py-2.5">
      {audioError && (
        <div className="text-[11.5px] text-[#f2a7a0]">
          This narration isn&apos;t available right now — you can still read this slide and move on.
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <audio
          ref={(el) => {
            audioRef.current = el;
            if (el) el.volume = muted ? 0 : volume;
          }}
          src={slide.narrationUrl}
          autoPlay={autoPlayNarration}
          className="hidden"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setMediaBuffering(true)}
          onPlaying={() => setMediaBuffering(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
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
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white text-neutral-900"
        >
          {isPlaying ? <PauseIcon width={14} height={14} /> : <PlayIcon width={14} height={14} />}
        </button>
        <span className="w-9 flex-none text-right text-[11px] text-white/70">{fmtTime(currentTime)}</span>
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
          className="h-1 flex-1 accent-accent-2"
        />
        <span className="w-9 flex-none text-[11px] text-white/70">{fmtTime(duration)}</span>
        <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="flex-none text-white/80">
          <VolumeIcon width={15} height={15} muted={muted || volume === 0} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="h-1 w-16 flex-none accent-accent-2"
        />
      </div>
    </div>
  );
}
