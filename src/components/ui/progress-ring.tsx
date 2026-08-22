import { cn } from "@/lib/cn";

/** Conic-gradient progress ring — the percentage is always passed in already derived (never computed here). */
export function ProgressRing({
  percent,
  size = 96,
  thickness = 9,
  label,
  sublabel,
  className,
}: {
  percent: number;
  size?: number;
  thickness?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className={cn("relative rounded-full flex items-center justify-center shrink-0", className)}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--color-accent) 0 ${clamped}%, var(--color-neutral-200) 0)`,
      }}
    >
      <div
        className="rounded-full bg-bg flex flex-col items-center justify-center"
        style={{ width: size - thickness * 2, height: size - thickness * 2 }}
      >
        {/* Explicit color, not inherited — this circle's bg-bg is light even
            when the ring sits on a dark hero (programme-overview.tsx) whose
            ancestor sets text-white, which otherwise renders this invisibly
            (white-on-white). */}
        <div className="font-heading font-bold text-lg leading-none text-text">{label ?? `${clamped}%`}</div>
        {sublabel && <div className="text-[10px] text-neutral-500 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}
