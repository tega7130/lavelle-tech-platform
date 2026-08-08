import { CheckIcon, LockIcon, EyeIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * The rail's per-lecture indicator: a gold check for COMPLETED, a blue
 * eye for "viewed but not complete" (IN_PROGRESS), a lock for a lecture
 * whose module hasn't released yet, and an empty ring otherwise.
 */
export function LectureStateDot({
  state,
  isLocked,
  dark,
}: {
  state: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  isLocked?: boolean;
  dark?: boolean;
}) {
  if (isLocked) {
    return (
      <span className={cn("w-[18px] h-[18px] flex items-center justify-center", dark ? "text-white/35" : "text-neutral-400")}>
        <LockIcon width={12} height={12} />
      </span>
    );
  }
  if (state === "COMPLETED") {
    return (
      <span className="w-[18px] h-[18px] rounded-full bg-accent-2 text-accent-900 flex items-center justify-center shrink-0">
        <CheckIcon width={11} height={11} strokeWidth={2.2} />
      </span>
    );
  }
  if (state === "IN_PROGRESS") {
    return (
      <span className="w-[18px] h-[18px] rounded-full bg-accent-500/20 text-accent-400 flex items-center justify-center shrink-0">
        <EyeIcon width={11} height={11} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "w-[18px] h-[18px] rounded-full border shrink-0",
        dark ? "border-white/25" : "border-neutral-300"
      )}
    />
  );
}
