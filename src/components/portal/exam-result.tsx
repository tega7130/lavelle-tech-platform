import Link from "next/link";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { buttonClassName } from "@/components/ui/button";
import type { getExamResultForCandidate } from "@/lib/exam-candidate-reads";

type Data = Awaited<ReturnType<typeof getExamResultForCandidate>>;

const BAND_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  DISTINCTION: "success",
  MERIT: "accent",
  PASS: "warning",
  REFER: "danger",
};
const BAND_LABEL: Record<string, string> = { DISTINCTION: "Distinction", MERIT: "Merit", PASS: "Pass", REFER: "Refer" };

function fmtDate(d: Date | string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

export function ExamResult({ data }: { data: Data }) {
  const { sitting, exam, programme, writtenAnswers } = data;
  const passed = sitting.outcome === "PASS";

  return (
    <div className="max-w-[820px] flex flex-col gap-[var(--space-5)]">
      <div>
        <Link href="/portal/exams" className="text-accent text-[12.5px] font-medium">
          ← All examinations
        </Link>
        <h1 className="font-heading text-2xl mt-2 mb-0">{programme.title} — Result</h1>
        <div className="text-neutral-500 text-[12.5px] mt-1">
          Window {fmtDate(data.window.opensAt)} · Released {fmtDate(sitting.releasedAt)}
        </div>
      </div>

      <Card elev="md" className={passed ? "border-accent-2-300" : "border-[#f3c4bf]"}>
        <div className="flex items-center gap-6 flex-wrap">
          <div
            className="w-[92px] h-[92px] rounded-full flex-none flex flex-col items-center justify-center border-4"
            style={{ borderColor: passed ? "var(--color-accent-2)" : "#e8b4ae" }}
          >
            <div className="font-heading font-bold text-2xl">{sitting.totalPercent ?? "—"}%</div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag variant={passed ? "success" : "danger"}>{passed ? "Pass" : "Refer"}</Tag>
              {sitting.band && <Tag variant={BAND_TAG[sitting.band]}>{BAND_LABEL[sitting.band]}</Tag>}
            </div>
            <p className="text-neutral-600 text-[13px] mt-2">
              {passed
                ? `You met the pass mark of ${exam.passMarkPercent}%.`
                : `The pass mark for this examination is ${exam.passMarkPercent}%. Contact support about a resit under your attempt policy.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-dashed border-neutral-300">
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Multiple choice</div>
            <div className="text-[15px] font-medium mt-0.5">{sitting.objectivePercent != null ? `${sitting.objectivePercent}%` : "—"}</div>
          </div>
          <div>
            <div className="text-neutral-500 text-[10px] tracking-[0.1em] uppercase">Written answers</div>
            <div className="text-[15px] font-medium mt-0.5">{sitting.writtenPercent != null ? `${sitting.writtenPercent}%` : "—"}</div>
          </div>
        </div>
      </Card>

      {writtenAnswers.length > 0 && (
        <Card elev="sm">
          <CardKicker>Written answer feedback</CardKicker>
          <div className="flex flex-col gap-4 mt-3">
            {writtenAnswers.map((w, i) => (
              <div key={i} className="pb-4 border-b border-dashed border-neutral-300 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-medium">{w.prompt}</div>
                  <span className="text-neutral-500 text-[11.5px] flex-none">
                    {w.scorePercent != null ? `${w.scorePercent}%` : "—"} of {w.marks} marks
                  </span>
                </div>
                {w.feedback && <p className="text-neutral-600 text-[12.5px] mt-2 leading-relaxed">{w.feedback}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Link href="/portal/exams" className={buttonClassName("secondary", "self-start")}>
        Back to examinations
      </Link>
    </div>
  );
}
