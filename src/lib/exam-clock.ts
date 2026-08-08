/**
 * The server owns the clock (rule 4/7). expiresAt is computed ONCE, at
 * start, from startedAt + durationMinutes — never recomputed on
 * reconnect or reload. Every write path checks isSittingExpired against
 * this stored value, never against a client-supplied time.
 */
export function computeExpiresAt(startedAt: Date, durationMinutes: number): Date {
  return new Date(startedAt.getTime() + durationMinutes * 60_000);
}

export function isSittingExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return now.getTime() >= expiresAt.getTime();
}
