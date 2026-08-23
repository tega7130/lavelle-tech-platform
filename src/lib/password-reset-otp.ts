import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
// Same rationale as email-otp.ts's VERIFIED_GRACE_MS: long enough to
// finish the new-password step, short enough that a verified-but-abandoned
// reset can't be replayed hours later.
const VERIFIED_GRACE_MS = 30 * 60 * 1000;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Forgot-password step for a candidate account that already exists — keyed
 * by candidateId, not email (see the PasswordResetOtpChallenge model
 * comment: the account is real by the time this is created, unlike
 * registration's EmailOtpChallenge). Requesting a new code invalidates any
 * outstanding one for the same candidate — only the latest is checkable.
 */
export async function createPasswordResetOtpChallenge(candidateId: string): Promise<string> {
  const code = generateCode();
  await prisma.$transaction([
    prisma.passwordResetOtpChallenge.deleteMany({ where: { candidateId, verifiedAt: null } }),
    prisma.passwordResetOtpChallenge.create({
      data: { candidateId, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    }),
  ]);
  return code;
}

/** No email provider is wired up in this slice — same honest dev stand-in as email-otp.ts's logOtpEmail. */
export function logPasswordResetOtpEmail(email: string, code: string) {
  console.log(`[dev] password reset OTP for ${email}: ${code}`);
}

export type OtpVerifyResult = "ok" | "invalid" | "expired" | "too_many_attempts" | "not_found";

/** Checks the code against the latest unverified challenge for the candidate. Attempts are capped to blunt brute force against a 6-digit space. */
export async function verifyPasswordResetOtpChallenge(candidateId: string, code: string): Promise<OtpVerifyResult> {
  const challenge = await prisma.passwordResetOtpChallenge.findFirst({
    where: { candidateId, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return "not_found";
  if (challenge.attempts >= MAX_ATTEMPTS) return "too_many_attempts";
  if (challenge.expiresAt < new Date()) return "expired";

  if (challenge.codeHash !== hashCode(code)) {
    await prisma.passwordResetOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return "invalid";
  }

  await prisma.passwordResetOtpChallenge.update({
    where: { id: challenge.id },
    data: { verifiedAt: new Date() },
  });
  return "ok";
}

/** Has this candidate completed OTP verification recently enough to reset their password on? Consumed (deleted) once used so it can't be replayed. */
export async function consumeVerifiedPasswordResetOtp(candidateId: string): Promise<boolean> {
  const challenge = await prisma.passwordResetOtpChallenge.findFirst({
    where: { candidateId, verifiedAt: { gt: new Date(Date.now() - VERIFIED_GRACE_MS) } },
    orderBy: { verifiedAt: "desc" },
  });
  if (!challenge) return false;
  await prisma.passwordResetOtpChallenge.delete({ where: { id: challenge.id } });
  return true;
}
