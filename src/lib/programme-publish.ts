/**
 * Pure business-rule checks, kept free of auth/DB-session concerns so
 * they're directly unit-testable (and so setProgrammeStatus stays a thin
 * wrapper: fetch, check, write, audit).
 */

export interface PublishCheckInput {
  modules: { title: string; lectures: unknown[] }[];
  assessmentWeightings: { weightPercent: number }[];
  feeMinor: number;
}

/** Rule 2: at least one module; every module has a lecture; weights total 100; fee > 0. Returns the specific failures, not a generic refusal. */
export function computePublishFailures(programme: PublishCheckInput): string[] {
  const failures: string[] = [];

  if (programme.modules.length === 0) failures.push("Add at least one module.");

  const emptyModules = programme.modules.filter((m) => m.lectures.length === 0);
  if (emptyModules.length > 0) {
    failures.push(`Add at least one lecture to: ${emptyModules.map((m) => m.title).join(", ")}.`);
  }

  const totalWeight = programme.assessmentWeightings.reduce((a, w) => a + w.weightPercent, 0);
  if (programme.assessmentWeightings.length < 3 || totalWeight !== 100) {
    failures.push(`Assessment weights total ${totalWeight}% — they must total exactly 100%.`);
  }

  if (programme.feeMinor <= 0) failures.push("Set a fee greater than zero.");

  return failures;
}

export interface QuizOptionInput {
  text: string;
  isCorrect: boolean;
}
export interface QuizQuestionInput {
  prompt: string;
  options: QuizOptionInput[];
}

/** Rule 8: exactly one correct option per question. Returns the first violation's message, or null if the whole set is valid. */
export function validateOneCorrectOptionPerQuestion(questions: QuizQuestionInput[]): string | null {
  for (const [i, q] of questions.entries()) {
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      return `Question ${i + 1} ("${q.prompt.slice(0, 60)}") must have exactly one correct option — found ${correctCount}.`;
    }
  }
  return null;
}
