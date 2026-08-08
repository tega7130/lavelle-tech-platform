const DUE_SOON_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

export type ComputedDeadlineState = "UPCOMING" | "DUE_SOON" | "OVERDUE" | "MET" | "WAIVED";

/**
 * DeadlineState is computed from timestamps, never stored (rule 10) — a
 * stored state needs a cron job to stay honest and is wrong between runs.
 * metAt -> MET; waivedAt -> WAIVED; dueAt < now -> OVERDUE; within 72
 * hours -> DUE_SOON; else UPCOMING.
 */
export function computeDeadlineState(
  d: { dueAt: Date; metAt: Date | null; waivedAt: Date | null },
  now: Date = new Date()
): ComputedDeadlineState {
  if (d.metAt) return "MET";
  if (d.waivedAt) return "WAIVED";
  const msRemaining = d.dueAt.getTime() - now.getTime();
  if (msRemaining < 0) return "OVERDUE";
  if (msRemaining <= DUE_SOON_WINDOW_MS) return "DUE_SOON";
  return "UPCOMING";
}
