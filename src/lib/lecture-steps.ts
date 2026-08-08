/**
 * The four-step lecture, derived from what's actually authored — never
 * hardcoded (rule 3). Every lecture has content; scenario and drafting
 * are present only when the corresponding prompt was authored; quiz
 * appears only on the last lecture of a module that has one (README:
 * "the module quiz ... shown on the last lecture of a module").
 */
export type LectureStep = "content" | "scenario" | "drafting" | "quiz";

export interface LectureStepContext {
  scenarioPrompt: string | null;
  draftingPrompt: string | null;
  isLastInModule: boolean;
  moduleHasQuiz: boolean;
}

export function deriveLectureSteps(lecture: LectureStepContext): LectureStep[] {
  const steps: LectureStep[] = ["content"];
  if (lecture.scenarioPrompt) steps.push("scenario");
  if (lecture.draftingPrompt) steps.push("drafting");
  if (lecture.isLastInModule && lecture.moduleHasQuiz) steps.push("quiz");
  return steps;
}

/** A lecture completes when every authored step is done — not when the video ends (rule 3). */
export function isLectureComplete(stepsCompleted: string[], steps: LectureStep[]): boolean {
  return steps.length > 0 && steps.every((s) => stepsCompleted.includes(s));
}
