import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
// A verified challenge stays usable for this long — long enough to finish
// the password step of registration, short enough that a verified-but-
// abandoned signup can't be replayed hours later against a different email.
const VERIFIED_GRACE_MS = 30 * 60 * 1000;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Registration's email-ownership step happens before any Candidate row
 * exists, so this is keyed by email rather than candidateId (see the
 * EmailOtpChallenge model comment). Requesting a new code invalidates any
 * outstanding one for the same email — only the latest is checkable.
 */
export async function createOtpChallenge(email: string): Promise<string> {
  const code = generateCode();
  await prisma.$transaction([
    prisma.emailOtpChallenge.deleteMany({ where: { email, verifiedAt: null } }),
    prisma.emailOtpChallenge.create({
      data: { email, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    }),
  ]);
  return code;
}

/**
 * No email provider is wired up in this slice — same honest dev stand-in
 * as verification-token.ts's logVerificationEmail. Swap for a real
 * provider call without touching the challenge lifecycle.
 */
export function logOtpEmail(email: string, code: string) {
  console.log(`[dev] registration OTP for ${email}: ${code}`);
}

export type OtpVerifyResult = "ok" | "invalid" | "expired" | "too_many_attempts" | "not_found";

/** Checks the code against the latest unverified challenge for the email. Attempts are capped to blunt brute force against a 6-digit space. */
export async function verifyOtpChallenge(email: string, code: string): Promise<OtpVerifyResult> {
  const challenge = await prisma.emailOtpChallenge.findFirst({
    where: { email, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return "not_found";
  if (challenge.attempts >= MAX_ATTEMPTS) return "too_many_attempts";
  if (challenge.expiresAt < new Date()) return "expired";

  if (challenge.codeHash !== hashCode(code)) {
    await prisma.emailOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return "invalid";
  }

  await prisma.emailOtpChallenge.update({
    where: { id: challenge.id },
    data: { verifiedAt: new Date() },
  });
  return "ok";
}

/** Has this email completed OTP verification recently enough to finish registration on? Consumed (deleted) once used so it can't be replayed. */
export async function consumeVerifiedOtp(email: string): Promise<boolean> {
  const challenge = await prisma.emailOtpChallenge.findFirst({
    where: { email, verifiedAt: { gt: new Date(Date.now() - VERIFIED_GRACE_MS) } },
    orderBy: { verifiedAt: "desc" },
  });
  if (!challenge) return false;
  await prisma.emailOtpChallenge.delete({ where: { id: challenge.id } });
  return true;
}
