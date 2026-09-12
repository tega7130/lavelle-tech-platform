import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

// Same validity window as email-otp.ts / password-reset-otp.ts's OTP
// challenges — one consistent expectation across every "enter a 6-digit
// code" flow in the app.
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const STAFF_LOGIN_OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Sign-in-by-code, an alternative to the password form on the same
 * /staff/sign-in page — mirrors createPasswordResetOtpChallenge, keyed
 * by staffId since (unlike registration's EmailOtpChallenge) the
 * account already exists. Requesting a new code invalidates any
 * outstanding one for the same staff member — only the latest is
 * checkable.
 */
export async function createStaffLoginOtpChallenge(staffId: string): Promise<string> {
  const code = generateCode();
  await prisma.$transaction([
    prisma.staffLoginOtpChallenge.deleteMany({ where: { staffId, verifiedAt: null } }),
    prisma.staffLoginOtpChallenge.create({
      data: { staffId, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    }),
  ]);
  return code;
}

export type OtpVerifyResult = "ok" | "invalid" | "expired" | "too_many_attempts" | "not_found";

/** Checks the code against the latest unverified challenge for the staff member. Attempts are capped to blunt brute force against a 6-digit space. */
export async function verifyStaffLoginOtpChallenge(staffId: string, code: string): Promise<OtpVerifyResult> {
  const challenge = await prisma.staffLoginOtpChallenge.findFirst({
    where: { staffId, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return "not_found";
  if (challenge.attempts >= MAX_ATTEMPTS) return "too_many_attempts";
  if (challenge.expiresAt < new Date()) return "expired";

  if (challenge.codeHash !== hashCode(code)) {
    await prisma.staffLoginOtpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return "invalid";
  }

  // Marking verifiedAt is enough to retire the challenge — the
  // `verifiedAt: null` filter above means a verified row can never be
  // matched again, so there's no separate consume step (unlike
  // email-otp.ts's registration flow, login has no second step to hold
  // a grace window open for).
  await prisma.staffLoginOtpChallenge.update({
    where: { id: challenge.id },
    data: { verifiedAt: new Date() },
  });
  return "ok";
}
