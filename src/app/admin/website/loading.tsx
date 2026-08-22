import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-[1400px]">
      <Skeleton className="h-3 w-[130px]" />
      <Skeleton className="h-6 w-[280px] mt-3" />
      <Skeleton className="h-9 w-full mt-4" />

      <div className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2 mt-[var(--space-5)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full" />
        ))}
      </div>
    </div>
  );
}
