import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-[1400px]">
      <Skeleton className="h-4 w-[90px] mb-[var(--space-4)]" />
      <div className="border border-divider rounded-md p-[var(--space-4)] flex flex-col gap-[var(--space-4)]">
        <Skeleton className="h-[80px] w-full" />
        <Skeleton className="h-[60px] w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-[240px] w-full" />
      </div>
    </div>
  );
}
