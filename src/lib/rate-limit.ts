import "server-only";
import { prisma } from "@/lib/prisma";

export class RateLimitError extends Error {
  constructor(message = "Too many attempts. Try again shortly.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Fixed-window counter backed by Postgres (RateLimitAttempt) rather than
 * memory — an in-memory limiter doesn't survive serverless, where each
 * invocation can land on a different instance.
 */
async function checkBucket(bucketKey: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const row = await prisma.rateLimitAttempt.upsert({
    where: { bucketKey_windowStart: { bucketKey, windowStart } },
    create: { bucketKey, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  return row.count <= limit;
}

export interface RateLimitKey {
  ip?: string | null;
  email?: string | null;
}

/**
 * Checks both the IP bucket and the email bucket (whichever are present)
 * for `action` and throws RateLimitError if either is exhausted.
 * Registration is unauthenticated and free, which makes it the obvious
 * abuse surface — every write path this guards should call it before
 * doing any work.
 */
export async function enforceRateLimit(
  action: string,
  key: RateLimitKey,
  opts: { limit: number; windowSeconds: number }
) {
  const checks: Promise<boolean>[] = [];
  if (key.ip) checks.push(checkBucket(`${action}:ip:${key.ip}`, opts.limit, opts.windowSeconds));
  if (key.email) checks.push(checkBucket(`${action}:email:${key.email.toLowerCase()}`, opts.limit, opts.windowSeconds));
  const results = await Promise.all(checks);
  if (results.some((allowed) => !allowed)) throw new RateLimitError();
}
