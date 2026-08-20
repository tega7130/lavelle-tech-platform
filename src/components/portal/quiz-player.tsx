"use client";

import * as React from "react";
import { Card, CardKicker } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { startQuizAttemptAction, submitQuizAttemptAction } from "@/app/actions/player";

type QuizAttemptData = Awaited<ReturnType<typeof startQuizAttemptAction>>;
type SubmitResult = Awaited<ReturnType<typeof submitQuizAttemptAction>>;

function gradeTag(scorePercent: number, passMarkPercent: number): { label: string; variant: "success" | "accent" | "warning" | "danger" } {
  if (scorePercent < passMarkPercent) return { label: "Refer", variant: "danger" };
  if (scorePercent >= 85) return { label: "Distinction", variant: "success" };
  if (scorePercent >= 70) return { label: "Merit", variant: "accent" };
  return { label: "Pass", variant: "warning" };
}

export function QuizPlayer({
  enrolmentId,
  quizId,
  onCompleted,
  onAttemptStart,
}: {
  enrolmentId: string;
  quizId: string;
  onCompleted?: () => void;
  onAttemptStart?: () => void;
}) {
  const [attempt, setAttempt] = React.useState<QuizAttemptData | null>(null);
  const [qIndex, setQIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<SubmitResult | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function start() {
    setBusy(true);
    try {
      onAttemptStart?.();
      const data = await startQuizAttemptAction(enrolmentId, quizId);
      setAttempt(data);
      setQIndex(0);
      setAnswers({});
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!attempt) return;
    setBusy(true);
    try {
      const payload = attempt.questions.map((q) => ({ questionId: q.id, selectedOptionId: answers[q.id] ?? null }));
      const data = await submitQuizAttemptAction(attempt.attemptId, payload);
      setResult(data);
      onCompleted?.();
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const grade = gradeTag(result.scorePercent, result.passMarkPercent);
    return (
      <Card elev="sm" className="text-center py-[var(--space-6)]">
        <div className="font-heading text-4xl font-bold">{result.scorePercent}%</div>
        <Tag variant={grade.variant} className="mt-2 self-center">
          {grade.label}
        </Tag>
        <div className="flex gap-2 justify-center mt-[var(--space-4)]">
          <Button variant="secondary" onClick={start} disabled={busy}>
            Retake quiz
          </Button>
        </div>
        <div className="text-left mt-[var(--space-6)] flex flex-col gap-3 max-w-[520px] mx-auto">
          <CardKicker>Answer review</CardKicker>
          {result.results.map((r, i) => (
            <div key={r.questionId} className="border border-divider rounded-md p-3 text-[13px]">
              <div className="flex items-center gap-2">
                <Tag variant={r.isCorrect ? "success" : "danger"}>{r.isCorrect ? "Correct" : "Incorrect"}</Tag>
                <span className="text-neutral-500 text-xs">Question {i + 1}</span>
              </div>
              {r.explanation && <p className="text-neutral-600 mt-1.5 mb-0">{r.explanation}</p>}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!attempt) {
    return (
      <Card elev="sm" className="text-center py-[var(--space-6)]">
        <div className="font-heading font-semibold text-[16px]">Module quiz</div>
        <p className="text-neutral-600 text-[13px] mt-1 mb-0">A short set of questions on this module — auto-marked.</p>
        <Button className="self-center mt-[var(--space-4)]" onClick={start} disabled={busy}>
          Start quiz
        </Button>
      </Card>
    );
  }

  const question = attempt.questions[qIndex]!;
  const isLast = qIndex === attempt.questions.length - 1;

  return (
    <Card elev="sm">
      <div className="text-[12px] text-neutral-500">
        Question {qIndex + 1} of {attempt.questions.length}
      </div>
      <div className="h-1 bg-neutral-200 rounded-full mt-1.5 mb-4 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full"
          style={{ width: `${((qIndex + 1) / attempt.questions.length) * 100}%` }}
        />
      </div>
      <div className="font-heading font-semibold text-[15px] mb-3">{question.prompt}</div>
      <div className="flex flex-col gap-2">
        {question.options.map((opt, oi) => {
          const selected = answers[question.id] === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: opt.id }))}
              className={`flex items-center gap-2.5 text-left px-3 py-2.5 rounded-md border text-[13px] cursor-pointer ${
                selected ? "border-accent bg-accent-100" : "border-divider hover:bg-neutral-100"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  selected ? "bg-accent text-white" : "bg-neutral-200 text-neutral-600"
                }`}
              >
                {String.fromCharCode(65 + oi)}
              </span>
              {opt.text}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-[var(--space-5)]">
        <Button variant="secondary" onClick={() => setQIndex((i) => Math.max(0, i - 1))} disabled={qIndex === 0}>
          Previous
        </Button>
        {isLast ? (
          <Button onClick={submit} disabled={busy}>
            Submit quiz
          </Button>
        ) : (
          <Button onClick={() => setQIndex((i) => i + 1)}>Next</Button>
        )}
      </div>
    </Card>
  );
}
