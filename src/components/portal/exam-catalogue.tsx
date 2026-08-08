import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import { AssessmentIcon } from "@/components/icons";
import { formatNaira, tierLabel } from "@/lib/format";
import type { listExamsForCandidate } from "@/lib/exam-candidate-reads";

type Exams = Awaited<ReturnType<typeof listExamsForCandidate>>;

export function ExamCatalogue({ exams }: { exams: Exams }) {
  if (exams.length === 0) {
    return (
      <div className="max-w-[640px] mx-auto text-center py-16">
        <div className="w-11 h-11 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center mx-auto mb-3">
          <AssessmentIcon width={20} height={20} />
        </div>
        <div className="font-heading font-semibold text-[16px]">No examinations available to you</div>
        <p className="text-neutral-600 text-[13px] mt-1.5 max-w-[48ch] mx-auto">
          Certifying examinations open to candidates with an active enrolment. Once you enrol, the monthly windows and fees appear here.
        </p>
        <Link href="/portal/catalogue" className={buttonClassName("primary", "mt-5")}>
          Browse the catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1120px]">
      <h1 className="font-heading text-2xl m-0">Certifying examinations</h1>
      <p className="text-neutral-600 text-[13.5px] max-w-[64ch] mt-1.5 mb-[var(--space-5)]">
        Each examination certifies a specialization at one tier of the ladder. Sitting an examination is a separate transaction from programme
        enrolment — you may sit one whether or not you took the course.
      </p>

      <div className="grid gap-[var(--space-4)]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))" }}>
        {exams.map((x) => {
          const eligible = x.eligibility.eligible;
          const stateTag: TagVariant | "success" | "warning" | "danger" = eligible ? "success" : "warning";
          return (
            <Card key={x.examId} elev="sm" className="p-0 gap-0 overflow-hidden">
              <div className="h-[3px]" style={{ background: eligible ? "var(--color-accent)" : "var(--color-neutral-300)" }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Tag variant="accent">{tierLabel(x.programme.tier)}</Tag>
                  <Tag variant={stateTag}>{eligible ? "Open" : "Ineligible"}</Tag>
                </div>
                <div className="font-heading font-semibold text-[16.5px] leading-snug mt-4">{x.programme.title}</div>
                <div className="text-neutral-500 text-[12px] mt-0.5">{x.programme.code}</div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-dashed border-neutral-300">
                  <div>
                    <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Exam fee</div>
                    <div className="text-[13.5px] font-medium mt-0.5">{formatNaira(x.feeMinor)}</div>
                  </div>
                  <div>
                    <div className="text-neutral-500 text-[9.5px] tracking-[0.1em] uppercase">Next window</div>
                    <div className="text-[13.5px] font-medium mt-0.5">
                      {x.nextWindow ? new Date(x.nextWindow.opensAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "None scheduled"}
                    </div>
                  </div>
                </div>

                {x.courseMet && (
                  <div className="flex items-center gap-2 mt-4 px-[11px] py-2 rounded-md bg-accent-2-100 border border-accent-2-300">
                    <span className="w-[15px] h-[15px] flex-none rounded-full bg-accent-2 text-accent-900 flex items-center justify-center text-[9px] font-bold">✓</span>
                    <span className="text-[11.5px] font-medium text-accent-2-800">Course requirement met</span>
                  </div>
                )}

                <Link href={`/portal/exams/${x.programme.code}`} className={buttonClassName("primary", "w-full justify-center mt-4 h-10 text-[13px]")}>
                  {eligible ? "View and register" : "View requirements"}
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
