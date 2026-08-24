import { getCandidateFunnel } from "@/lib/funnel-analytics";

export default async function FunnelPage() {
  const stages = await getCandidateFunnel();

  return (
    <div className="max-w-[1000px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Analytics</div>
      <h1 className="font-heading text-2xl mt-0.5 mb-1">Candidate funnel</h1>
      <p className="text-neutral-600 text-[13px] mb-[var(--space-6)] max-w-[68ch]">
        Every candidate, stage by stage, counted once each — from registration through to a certificate. Each segment's width
        narrows proportionally to show dropout. The percentage shows stage-to-stage retention.
      </p>

      <div className="bg-bg border border-divider rounded-lg p-8 overflow-x-auto">
        <FunnelVisualization stages={stages} />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-heading text-[14px] font-semibold mb-3">Stage details</h3>
          <div className="flex flex-col gap-2">
            {stages.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-[13px] p-2.5 rounded border border-divider">
                <span className="text-text font-medium">{s.label}</span>
                <span className="text-neutral-600 tabular-nums">{s.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-heading text-[14px] font-semibold mb-3">Retention rate</h3>
          <div className="flex flex-col gap-2">
            {stages.map((s, i) => (
              <div key={s.key} className="flex items-center justify-between text-[13px] p-2.5 rounded border border-divider">
                <span className="text-text">{s.label}</span>
                {s.pctOfPrevious != null ? (
                  <span className="tabular-nums font-semibold">{s.pctOfPrevious}% of prev.</span>
                ) : (
                  <span className="text-neutral-400 text-[12px]">Baseline</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelVisualization({ stages }: { stages: Array<{ label: string; count: number; pctOfTotal: number; pctOfPrevious: number | null }> }) {
  const colors = [
    "hsl(211, 100%, 50%)", // blue-500
    "hsl(195, 100%, 48%)", // cyan
    "hsl(172, 100%, 45%)", // teal
    "hsl(163, 72%, 51%)", // emerald
    "hsl(142, 72%, 45%)", // green
    "hsl(41, 96%, 56%)", // amber
    "hsl(24, 94%, 50%)", // orange
  ];

  const baseWidth = 560; // pixels
  const segmentHeight = 80;
  const totalHeight = stages.length * segmentHeight;

  return (
    <svg width={baseWidth + 100} height={totalHeight + 40} className="mx-auto" viewBox={`0 0 ${baseWidth + 100} ${totalHeight + 40}`}>
      {stages.map((stage, index) => {
        const maxCount = stages[0]?.count ?? 1;
        const widthRatio = stage.count / maxCount;
        const startWidth = baseWidth * widthRatio;
        const endWidth = index < stages.length - 1 ? (baseWidth * (stages[index + 1]?.count ?? 0)) / maxCount : startWidth * 0.7;

        const y = index * segmentHeight + 20;
        const x1 = (baseWidth - startWidth) / 2 + 50;
        const x2 = x1 + startWidth;
        const x3 = (baseWidth - endWidth) / 2 + 50;
        const x4 = x3 + endWidth;

        return (
          <g key={stage.label}>
            {/* Trapezoid */}
            <polygon
              points={`${x1},${y} ${x2},${y} ${x4},${y + segmentHeight} ${x3},${y + segmentHeight}`}
              fill={colors[index % colors.length]}
              fillOpacity="0.9"
              stroke="white"
              strokeWidth="2"
              className="transition-opacity hover:fill-opacity-100"
            />

            {/* Count in center */}
            <text
              x={(x1 + x2) / 2}
              y={y + segmentHeight / 2 - 8}
              textAnchor="middle"
              className="text-white font-bold text-[18px]"
              fill="white"
              dominantBaseline="middle"
            >
              {stage.count.toLocaleString()}
            </text>

            {/* Label and percentage */}
            <text
              x={(x1 + x2) / 2}
              y={y + segmentHeight / 2 + 8}
              textAnchor="middle"
              className="text-white text-[14px] font-semibold"
              fill="white"
              dominantBaseline="middle"
            >
              {stage.label}
            </text>

            {/* Percentage of total (bottom right) */}
            <text
              x={x2 - 8}
              y={y + segmentHeight - 4}
              textAnchor="end"
              className="text-white text-[11px] font-medium"
              fill="white"
              fillOpacity="0.8"
            >
              {stage.pctOfTotal}% of total
            </text>

            {/* Retention rate (right side) */}
            {stage.pctOfPrevious != null && (
              <g>
                <text
                  x={baseWidth + 60}
                  y={y + segmentHeight / 2}
                  className="text-[13px] font-semibold"
                  fill="currentColor"
                  dominantBaseline="middle"
                >
                  {stage.pctOfPrevious}%
                </text>
                <line x1={x2 + 2} y1={y + segmentHeight - 4} x2={baseWidth + 50} y2={y + segmentHeight / 2} stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
