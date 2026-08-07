import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Inserts the token row (hash only) and returns the plaintext — usable inside a caller-managed transaction. */
export async function createVerificationTokenRecord(db: Db, candidateId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.emailVerificationToken.create({
    data: {
      candidateId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}

/**
 * No email provider is wired up in this slice — this is an honest dev
 * stand-in (the link lands in the server log) rather than a fabricated
 * "email sent" that goes nowhere. Swap this for a real provider call
 * without touching anything else; the token lifecycle is already correct.
 */
export function logVerificationEmail(email: string, token: string) {
  const url = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/verify-email?token=${token}`;
  console.log(`[dev] verification email for ${email}: ${url}`);
}

export interface ConsumeResult {
  ok: boolean;
  candidateId?: string;
}

/** Resending invalidates outstanding tokens for that candidate (Handoff 01 README). */
export async function invalidateOutstandingTokens(candidateId: string) {
  await prisma.emailVerificationToken.updateMany({
    where: { candidateId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

/** Consumes a token (single use) and marks the candidate's email verified. Returns ok:false for missing/expired/already-used tokens. */
export async function consumeVerificationToken(plaintextToken: string): Promise<ConsumeResult> {
  const tokenHash = hashToken(plaintextToken);
  const record = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!record) return { ok: false };

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.candidate.update({
      where: { id: record.candidateId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return { ok: true, candidateId: record.candidateId };
}
