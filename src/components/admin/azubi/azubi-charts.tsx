/** Dependency-free horizontal bar list — label, proportional bar, value. */
export function AzubiBarList({ items, barColor = "var(--color-accent)" }: { items: { label: string; value: number }[]; barColor?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-[13px] text-neutral-600">No data yet.</p>;

  return (
    <div className="flex flex-col gap-[10px]">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <div className="w-[160px] flex-none text-[12.5px] text-text truncate" title={i.label}>
            {i.label}
          </div>
          <div className="flex-1 h-[16px] bg-neutral-100 rounded-[4px] overflow-hidden">
            <div className="h-full rounded-[4px]" style={{ width: `${(i.value / max) * 100}%`, backgroundColor: barColor }} />
          </div>
          <div className="w-[32px] flex-none text-right text-[12.5px] text-neutral-600">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Dependency-free weekly trend — a small column chart. */
export function AzubiWeeklyBars({ buckets }: { buckets: { weekStart: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  if (buckets.length === 0) return <p className="text-[13px] text-neutral-600">No data yet.</p>;

  return (
    <div className="flex items-end gap-[6px] h-[120px]">
      {buckets.map((b) => (
        <div key={b.weekStart} className="flex-1 flex flex-col items-center gap-1" title={`${b.weekStart}: ${b.count}`}>
          <div className="w-full bg-accent-100 rounded-t-[3px] relative" style={{ height: `${Math.max(2, (b.count / max) * 96)}px` }}>
            <div className="absolute inset-0 bg-accent rounded-t-[3px]" />
          </div>
          <span className="text-[9.5px] text-neutral-500 [writing-mode:vertical-rl] rotate-180 h-[44px]">
            {new Date(b.weekStart).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
          </span>
        </div>
      ))}
    </div>
  );
}
