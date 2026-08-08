import type { Prisma, PrismaClient, GradeBand } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Resolves the band against the GradeBandDefinition IN FORCE AT THE
 * ASSESSMENT DATE (rule 2) — never today's scale. A candidate's Merit
 * must not silently become a Pass because someone edited the bands after
 * the fact; the result of this call is stored on the Mark/ProgrammeResult
 * row, never re-derived on read.
 */
export async function resolveGradeBand(scorePercent: number, assessedAt: Date, db: Db): Promise<GradeBand> {
  const definitions = await db.gradeBandDefinition.findMany({
    where: {
      effectiveFrom: { lte: assessedAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: assessedAt } }],
    },
    orderBy: { minPercent: "desc" },
  });
  const match = definitions.find((d) => scorePercent >= d.minPercent);
  if (!match) throw new Error(`No grade band definition covers ${scorePercent}% as at ${assessedAt.toISOString()}.`);
  return match.band;
}

export interface FinalMarkComponents {
  quizAveragePercent: number | null;
  draftingAveragePercent: number | null;
  examinationPercent: number | null;
}

export interface AssessmentWeights {
  QUIZ: number;
  DRAFTING: number;
  EXAMINATION: number;
}

export interface FinalMarkResult {
  finalPercent: number | null;
  isProvisional: boolean;
}

/**
 * The weighted final mark — half-up, to the integer, ONCE, at the end
 * (rule 5). Never rounded per component; two roundings produce a mark
 * that fails to reconcile with its own components on appeal.
 *
 * A missing component is EXCLUDED from both the numerator and the
 * denominator — its weight is dropped, not treated as a zero (rule 4).
 * Dividing by the full 100 while a component is absent would understate
 * a strong part-way candidate (e.g. quiz 88% + drafting 78%, no exam yet,
 * weights 20/40/40: (88*20+78*40)/100 = 49% — a failing mark for someone
 * doing well). Renormalizing against the weight of what EXISTS —
 * (88*20+78*40)/(20+40) = 81% — is "the weighted average of what exists",
 * per the README, and is provisional until the exam lands.
 */
export function computeFinalMark(components: FinalMarkComponents, weights: AssessmentWeights): FinalMarkResult {
  const parts: { value: number; weight: number }[] = [];
  if (components.quizAveragePercent != null) parts.push({ value: components.quizAveragePercent, weight: weights.QUIZ });
  if (components.draftingAveragePercent != null) parts.push({ value: components.draftingAveragePercent, weight: weights.DRAFTING });
  if (components.examinationPercent != null) parts.push({ value: components.examinationPercent, weight: weights.EXAMINATION });

  if (parts.length === 0) return { finalPercent: null, isProvisional: true };

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const weightedSum = parts.reduce((sum, p) => sum + p.value * p.weight, 0);
  const raw = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const finalPercent = Math.floor(raw + 0.5); // half-up, once, at the end

  const allPresent = components.quizAveragePercent != null && components.draftingAveragePercent != null && components.examinationPercent != null;
  return { finalPercent, isProvisional: !allPresent };
}

/** Simple arithmetic mean, rounded — used for the quiz/drafting per-component averages that feed computeFinalMark. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.floor(values.reduce((a, b) => a + b, 0) / values.length + 0.5);
}
