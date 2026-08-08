/**
 * Module and programme percentages are always DERIVED on read, never
 * stored (rule 2) — Slice 02 lets an administrator add a lecture at any
 * time, and a stored percentage would be wrong the moment they do. These
 * are the pure percent-math helpers; the actual counting (against the
 * CURRENT module/lecture rows) lives in src/lib/player-reads.ts.
 */
export function computePercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}
