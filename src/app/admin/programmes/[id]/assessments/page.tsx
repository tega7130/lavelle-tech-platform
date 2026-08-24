import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProgrammeAssessmentStats } from "@/lib/assessment-analytics";
import { getVideoWatchStatsByProgramme } from "@/lib/video-analytics";
import { Tag } from "@/components/ui/tag";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "unknown length";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function ProgrammeAssessmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [programme, modules, videoStats] = await Promise.all([
    prisma.programme.findUnique({ where: { id }, select: { id: true, code: true, title: true } }),
    getProgrammeAssessmentStats(id),
    getVideoWatchStatsByProgramme(id),
  ]);
  if (!programme) notFound();

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4">
        <Link href="/admin/programmes" className="text-[12px] text-neutral-500 hover:text-neutral-700 no-underline">
          &larr; Programmes
        </Link>
        <div className="flex items-center justify-between gap-4 mt-1 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">{programme.code}</div>
            <h1 className="font-heading text-2xl mt-0.5">{programme.title} — Assessment performance</h1>
          </div>
          <Link href={`/admin/programmes/${programme.id}/enrolments`} className="text-[13px] text-accent no-underline">
            View enrolments →
          </Link>
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">This programme has no modules yet</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {modules.map((mod) => (
            <div key={mod.moduleId} className="border border-divider rounded-md p-4">
              <div className="font-heading font-semibold text-[14px] mb-3">
                Week {mod.weekNumber} — {mod.moduleTitle}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] tracking-[0.05em] uppercase text-neutral-500 mb-1.5">Module quiz</div>
                  {mod.quiz === null ? (
                    <span className="text-neutral-400 text-[13px]">No quiz on this module</span>
                  ) : mod.quiz.attempts === 0 ? (
                    <span className="text-neutral-400 text-[13px]">No attempts yet</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag variant="neutral">{mod.quiz.attempts} attempts</Tag>
                      <Tag variant={mod.quiz.passRate != null && mod.quiz.passRate >= 60 ? "success" : "warning"}>
                        {mod.quiz.passRate}% pass rate
                      </Tag>
                      <Tag variant="outline">{mod.quiz.averageScore}% average</Tag>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] tracking-[0.05em] uppercase text-neutral-500 mb-1.5">Drafting exercises</div>
                  {mod.drafting.marked === 0 ? (
                    <span className="text-neutral-400 text-[13px]">Nothing marked yet</span>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag variant="neutral">{mod.drafting.marked} marked</Tag>
                      <Tag variant={mod.drafting.passRate != null && mod.drafting.passRate >= 60 ? "success" : "warning"}>
                        {mod.drafting.passRate}% pass rate
                      </Tag>
                      <Tag variant="outline">{mod.drafting.averageScore}% average</Tag>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {videoStats.length > 0 && (
        <div className="mt-[var(--space-6)]">
          <div className="font-heading font-semibold text-[15px] mb-3">Video engagement</div>
          <div className="border border-divider rounded-md overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-divider py-[10px] pr-2 pl-[var(--space-4)] text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                    Lecture
                  </th>
                  <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                    Length
                  </th>
                  <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                    Watchers
                  </th>
                  <th className="border-b border-divider py-[10px] pr-2 text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                    Average watched
                  </th>
                  <th className="border-b border-divider py-[10px] pr-[var(--space-4)] text-left text-[11px] font-semibold tracking-[0.08em] text-neutral-600 uppercase">
                    Completed (90%+)
                  </th>
                </tr>
              </thead>
              <tbody>
                {videoStats.map((v) => (
                  <tr key={v.lectureId}>
                    <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 pl-[var(--space-4)]">
                      <div className="text-[13px]">{v.lectureTitle}</div>
                      <div className="text-[11px] text-neutral-500">
                        Week {v.weekNumber} · {v.moduleTitle}
                      </div>
                    </td>
                    <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px] tabular-nums">
                      {formatDuration(v.durationSeconds)}
                    </td>
                    <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px] tabular-nums">{v.watcherCount}</td>
                    <td className="border-b border-dashed border-neutral-300 py-[10px] pr-2 text-[13px]">
                      {v.averageWatchedPercent != null ? (
                        <Tag variant={v.averageWatchedPercent >= 70 ? "success" : v.averageWatchedPercent >= 30 ? "warning" : "danger"}>
                          {v.averageWatchedPercent}%
                        </Tag>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="border-b border-dashed border-neutral-300 py-[10px] pr-[var(--space-4)] text-[13px] tabular-nums">
                      {v.completedCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
