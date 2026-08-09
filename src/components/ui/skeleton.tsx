import { cn } from "@/lib/cn";

/** The shimmer block from Lavelle States.dc.html — for content whose shape is known, never a spinner. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("lv-skel", className)} />;
}
