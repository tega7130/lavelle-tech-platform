import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-[1400px]">
      <Skeleton className="h-3 w-[130px]" />
      <Skeleton className="h-6 w-[280px] mt-3" />
      <Skeleton className="h-9 w-full mt-4" />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-[var(--space-5)] items-start mt-[var(--space-5)]">
        <div className="border border-divider rounded-md p-[var(--space-3)] flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-[var(--space-4)]">
          <Skeleton className="h-[110px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    </div>
  );
}
