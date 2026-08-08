import type { ExamQuestionType, ExamQuestionStatus } from "@/generated/prisma/client";

export interface DrawableQuestion {
  id: string;
  moduleId: string;
  type: ExamQuestionType;
  status: ExamQuestionStatus;
  prompt: string;
  marks: number;
  guidance: string | null;
  wordLimit: number | null;
  options?: { id: string; text: string; isCorrect: boolean }[];
}

export interface PaperQuestion {
  questionId: string;
  moduleId: string;
  type: ExamQuestionType;
  prompt: string;
  marks: number;
  guidance: string | null;
  wordLimit: number | null;
  options?: { id: string; text: string }[]; // isCorrect stripped — never served to the candidate
}

/** Fisher-Yates — a real shuffle, not Array.sort(() => Math.random() - 0.5) (biased). */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function toPaperQuestion(q: DrawableQuestion, shuffleOptions: boolean): PaperQuestion {
  const options = q.options ? (shuffleOptions ? shuffle(q.options) : q.options).map((o) => ({ id: o.id, text: o.text })) : undefined;
  return { questionId: q.id, moduleId: q.moduleId, type: q.type, prompt: q.prompt, marks: q.marks, guidance: q.guidance, wordLimit: q.wordLimit, options };
}

/**
 * The type-aware draw (rule 2). Objective questions are drawn to the
 * module's number; EVERY approved written question is included,
 * regardless of position — a positional slice(0, draw) would silently
 * drop written questions, which sit last in the bank.
 */
export function drawPaper(
  modules: { moduleId: string; draw: number }[],
  questions: DrawableQuestion[],
  opts: { shuffleQuestions: boolean; shuffleOptions: boolean } = { shuffleQuestions: true, shuffleOptions: false }
): PaperQuestion[] {
  const paper: PaperQuestion[] = [];
  for (const m of modules) {
    const approved = questions.filter((q) => q.moduleId === m.moduleId && q.status === "APPROVED");
    const objectivePool = approved.filter((q) => q.type === "OBJECTIVE");
    const objectiveDrawn = (opts.shuffleQuestions ? shuffle(objectivePool) : objectivePool).slice(0, m.draw);
    const written = approved.filter((q) => q.type === "WRITTEN"); // every one, never sliced
    for (const q of objectiveDrawn) paper.push(toPaperQuestion(q, opts.shuffleOptions));
    for (const q of written) paper.push(toPaperQuestion(q, opts.shuffleOptions));
  }
  return opts.shuffleQuestions ? shuffle(paper) : paper;
}

export interface ModuleShortfall {
  moduleId: string;
  moduleTitle: string;
  approvedObjectiveCount: number;
  draw: number;
  shortBy: number;
}

/**
 * Rule 1 — names the offending modules, never refuses generically.
 * "Short" is judged on OBJECTIVE questions only: every approved written
 * question is always included regardless of count, so it never
 * contributes to a shortfall.
 */
export function computeShortfalls(
  modules: { moduleId: string; moduleTitle: string; draw: number; questions: DrawableQuestion[] }[]
): ModuleShortfall[] {
  const shortfalls: ModuleShortfall[] = [];
  for (const m of modules) {
    const approvedObjectiveCount = m.questions.filter((q) => q.moduleId === m.moduleId && q.type === "OBJECTIVE" && q.status === "APPROVED").length;
    if (approvedObjectiveCount < m.draw) {
      shortfalls.push({ moduleId: m.moduleId, moduleTitle: m.moduleTitle, approvedObjectiveCount, draw: m.draw, shortBy: m.draw - approvedObjectiveCount });
    }
  }
  return shortfalls;
}

/**
 * The "drawn per sitting" figure — each module clamped to its OWN
 * approved pool, never the configured sum (rule 1). A module configured
 * to draw 2 with only 1 approved contributes 1, not 2.
 */
export function computeActualDrawTotal(modules: { moduleId: string; draw: number; questions: DrawableQuestion[] }[]): number {
  let total = 0;
  for (const m of modules) {
    const approvedObjectiveCount = m.questions.filter((q) => q.moduleId === m.moduleId && q.type === "OBJECTIVE" && q.status === "APPROVED").length;
    total += Math.min(m.draw, approvedObjectiveCount);
    total += m.questions.filter((q) => q.moduleId === m.moduleId && q.type === "WRITTEN" && q.status === "APPROVED").length;
  }
  return total;
}
