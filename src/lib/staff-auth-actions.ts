import { prisma } from "@/lib/prisma";
import { StaffStatus } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { createStaffSessionRecord, revokeAllStaffSessions } from "@/lib/staff-session";
import { createInvitationTokenRecord, logStaffInvitationEmail, invalidateOutstandingStaffTokens, consumeInvitationToken, PASSWORD_RESET_TOKEN_TTL_MS } from "@/lib/staff-invitation";
import { sendStaffInvitationEmail } from "@/lib/staff-invite";
import { recordAuditEvent } from "@/lib/audit";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { getFirstName } from "@/lib/email-utils";
import { createStaffLoginOtpChallenge, verifyStaffLoginOtpChallenge, STAFF_LOGIN_OTP_EXPIRY_MINUTES, type OtpVerifyResult } from "@/lib/staff-login-otp";

// No "server-only" / staff-auth import here, deliberately — same
// discipline as marking-actions.ts / exam-builder-actions.ts / Slice 09's
// enquiry.ts. ip/userAgent/actingStaffId are always passed in by the
// caller (a "use server" Action that resolves them via next/headers or
// cookies(), which this file can't reach outside a request) — keeps
// every function here importable from plain Vitest tests.

// Rule 1 (README A5): wrong password, unknown address, invited-not-
// activated, suspended and deactivated all return this SAME message —
// anything more specific lets someone enumerate staff addresses.
export const GENERIC_SIGNIN_ERROR = "That email address and password do not match a staff account.";
export const LOCKOUT_MESSAGE = "Too many attempts. This account is locked for 15 minutes.";

const LOCKOUT_WINDOW_SECONDS = 15 * 60;
const LOCKOUT_LIMIT = 5; // per email — "five failures locks the account for 15 minutes"
const IP_LIMIT = 8; // per IP — stricter than candidate sign-in's 10, guards against one address hammering many accounts

/**
 * A SUSPENDED or DEACTIVATED account is refused exactly like a wrong
 * password (README A4) — this function is the single place that decides
 * "can this account sign in right now", so staffSignInCore and
 * setStaffPasswordCore's status re-check can't drift apart.
 */
function isUsableForSignIn(status: StaffStatus): boolean {
  return status === StaffStatus.ACTIVE;
}

export type StaffSignInResult = { ok: true; sessionToken: string } | { ok: false; message: string };

export async function staffSignInCore(email: string, password: string, ip: string | null, userAgent: string | null): Promise<StaffSignInResult> {
  // Broad per-IP guard against one address hammering many different
  // accounts — checked unconditionally, before any lookup.
  try {
    await enforceRateLimit("staffSignInIp", { ip }, { limit: IP_LIMIT, windowSeconds: LOCKOUT_WINDOW_SECONDS });
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, message: LOCKOUT_MESSAGE };
    throw e;
  }

  const normalizedEmail = email.toLowerCase();
  const staff = await prisma.staff.findUnique({ where: { email: normalizedEmail }, include: { permissionGrants: true } });

  // The per-account bucket is checked BEFORE verifying the password, on
  // every attempt — not just failures. A lockout must refuse EVERY
  // further try, including one with the correct password, for the full
  // 15 minutes; checking only on failure would let a legitimate sign-in
  // slip through mid-lockout. Keyed on the submitted email string
  // regardless of whether it matches a real account, so a real and a
  // fake address lock out identically (indistinguishable, rule 1).
  try {
    await enforceRateLimit("staffSignInEmail", { email: normalizedEmail }, { limit: LOCKOUT_LIMIT, windowSeconds: LOCKOUT_WINDOW_SECONDS });
  } catch (e) {
    if (e instanceof RateLimitError) {
      if (staff) {
        await recordAuditEvent(prisma, {
          subjectType: "staff",
          subjectId: staff.id,
          action: "staff.signin.locked",
          description: "Sign-in locked for 15 minutes after five failed attempts",
          ipAddress: ip,
        });
      }
      return { ok: false, message: LOCKOUT_MESSAGE };
    }
    throw e;
  }

  const passwordOk = staff?.passwordHash ? await verifyPassword(password, staff.passwordHash) : false;
  const usable = !!staff && isUsableForSignIn(staff.status) && passwordOk;

  if (!usable) return { ok: false, message: GENERIC_SIGNIN_ERROR };

  const sessionToken = await createStaffSessionRecord(prisma, staff.id, { userAgent, ipAddress: ip });
  await prisma.staff.update({ where: { id: staff.id }, data: { lastActiveAt: new Date() } });
  return { ok: true, sessionToken };
}

// Sign-in-by-code — a toggle on the same /staff/sign-in page, not a
// separate route. A staff member can switch between password and OTP
// freely on every visit; neither is the "primary" method.
const OTP_REQUEST_LIMIT = 5; // per email/IP, per 15 minutes — requesting codes, not verifying them
const OTP_REQUEST_WINDOW_SECONDS = 15 * 60;

/**
 * Always returns silently regardless of outcome (same rule as
 * requestStaffPasswordResetCore just above) — only sends a code when the
 * email matches an ACTIVE account, so a real and a fake address behave
 * identically from the caller's side.
 */
export async function requestStaffLoginOtpCore(email: string, ip: string | null): Promise<void> {
  try {
    await enforceRateLimit("staffLoginOtpRequest", { ip, email }, { limit: OTP_REQUEST_LIMIT, windowSeconds: OTP_REQUEST_WINDOW_SECONDS });
  } catch {
    return; // same silent, generic outcome as any other case
  }

  const normalizedEmail = email.toLowerCase();
  const staff = await prisma.staff.findUnique({ where: { email: normalizedEmail } });
  if (!staff || !isUsableForSignIn(staff.status)) return;

  const code = await createStaffLoginOtpChallenge(staff.id);

  // Awaited, not a detached IIFE. This used to say "fire-and-forget, same
  // discipline as requestStaffPasswordResetCore's email send" — that
  // discipline turned out to be the bug: on the serverless runtime an
  // un-awaited promise can be killed before it ever reaches sendEmail, so
  // the OTP silently never sends. Response contract is unchanged either
  // way — a provider hiccup still can't fail or reveal anything about the
  // request itself.
  try {
    await sendTransactionalEmailByTemplate("email-verification-otp", staff.email, {
      firstName: getFirstName(staff.name),
      otpCode: code,
      otpExpiryMinutes: STAFF_LOGIN_OTP_EXPIRY_MINUTES,
      currentYear: new Date().getFullYear(),
    });
  } catch (emailError) {
    console.error("Failed to send staff login OTP email:", emailError);
  }

  await recordAuditEvent(prisma, {
    subjectType: "staff",
    subjectId: staff.id,
    action: "staff.signin.otp_requested",
    description: "Requested a sign-in code",
    ipAddress: ip,
  });
}

export type StaffOtpVerifyResult = { ok: true; sessionToken: string } | { ok: false; message: string };

const OTP_VERIFY_MESSAGES: Record<Exclude<OtpVerifyResult, "ok">, string> = {
  not_found: "Request a new code to sign in.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many attempts. Request a new code.",
  invalid: "That code is incorrect.",
};

/**
 * Same per-IP guard as staffSignInCore, checked unconditionally before
 * any lookup — the per-code attempt cap (5, inside the challenge itself)
 * blunts brute force against one code, this blunts one address hammering
 * many different accounts' codes.
 */
export async function verifyStaffLoginOtpCore(email: string, code: string, ip: string | null, userAgent: string | null): Promise<StaffOtpVerifyResult> {
  try {
    await enforceRateLimit("staffLoginOtpVerifyIp", { ip }, { limit: IP_LIMIT, windowSeconds: LOCKOUT_WINDOW_SECONDS });
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, message: LOCKOUT_MESSAGE };
    throw e;
  }

  const normalizedEmail = email.toLowerCase();
  const staff = await prisma.staff.findUnique({ where: { email: normalizedEmail } });
  if (!staff || !isUsableForSignIn(staff.status)) return { ok: false, message: GENERIC_SIGNIN_ERROR };

  const result = await verifyStaffLoginOtpChallenge(staff.id, code);
  if (result !== "ok") return { ok: false, message: OTP_VERIFY_MESSAGES[result] };

  const sessionToken = await createStaffSessionRecord(prisma, staff.id, { userAgent, ipAddress: ip });
  await prisma.staff.update({ where: { id: staff.id }, data: { lastActiveAt: new Date() } });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "staff",
    subjectId: staff.id,
    action: "staff.signin.otp",
    description: "Signed in using a one-time code",
    ipAddress: ip,
  });

  return { ok: true, sessionToken };
}

export type SetStaffPasswordResult =
  | { ok: true; sessionToken: string | null; name: string; role: string }
  | { ok: false };

/**
 * Activation is one transaction (README A5 rule 3): the token is
 * re-validated and consumed, the account's CURRENT status is re-checked
 * (a token issued while INVITED/ACTIVE must not still work after the
 * account was suspended in between), the password is set, and the
 * session is created — all together or none of it, so a partial failure
 * can never consume the token without setting the password.
 *
 * sessionToken is null for a password reset (wasInvited false — a reset
 * token, per requestStaffPasswordResetCore's own guard, only ever exists
 * for an already-ACTIVE account) so the caller does not auto-sign the
 * admin in; it stays non-null for first-time invitation activation, which
 * keeps its existing "set password and land in the console" behaviour.
 */
export async function setStaffPasswordCore(token: string, password: string, ip: string | null, userAgent: string | null): Promise<SetStaffPasswordResult> {
  const passwordHash = await hashPassword(password);

  const result = await prisma.$transaction(async (tx) => {
    const consumed = await consumeInvitationToken(tx, token);
    if (!consumed) return null;

    const before = await tx.staff.findUniqueOrThrow({ where: { id: consumed.staffId } });
    if (before.status !== StaffStatus.INVITED && before.status !== StaffStatus.ACTIVE) return null;
    const wasInvited = before.status === StaffStatus.INVITED;

    const staff = await tx.staff.update({
      where: { id: before.id },
      data: {
        passwordHash,
        status: StaffStatus.ACTIVE,
        activatedAt: wasInvited ? new Date() : before.activatedAt,
      },
    });

    await recordAuditEvent(tx, {
      actorStaffId: staff.id,
      subjectType: "staff",
      subjectId: staff.id,
      action: wasInvited ? "staff.activated" : "staff.password_reset.completed",
      description: wasInvited ? `Activated the account as ${staff.role}` : "Reset the account password",
      ipAddress: ip,
    });

    // A password reset (not a first-time activation, which has no prior
    // sessions to speak of) revokes every session live before the reset —
    // a stolen/forgotten password shouldn't leave an old session usable
    // after the account holder locks it down with a new one.
    if (!wasInvited) await revokeAllStaffSessions(staff.id, tx);

    // Only a first-time activation signs the admin straight in — a
    // password reset returns to the normal sign-in page instead (README
    // H3-style rule: resetting an existing account's credential should
    // not itself be a way in).
    const sessionToken = wasInvited ? await createStaffSessionRecord(tx, staff.id, { userAgent, ipAddress: ip }) : null;
    return { sessionToken, name: staff.name, role: staff.role };
  });

  if (!result) return { ok: false };
  return { ok: true, ...result };
}

/**
 * Requires manage_staff (checked by the caller). Resending invalidates
 * every outstanding token first — two live links for one account is a
 * security hole (README A2).
 *
 * Actually sends the staff-invitation email (via the same
 * sendStaffInvitationEmail used by the original invite) — this
 * previously only regenerated the token and logged a dev-console URL,
 * so clicking "Resend invitation" silently sent nothing, which is
 * exactly the wrong failure mode for the one button a staff member's
 * missing invite is supposed to be fixed with.
 */
export async function resendStaffInvitationCore(staffId: string, actingStaffId: string): Promise<{ emailSent: boolean }> {
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId } });

  await invalidateOutstandingStaffTokens(staffId);
  const token = await createInvitationTokenRecord(prisma, staffId, actingStaffId);
  logStaffInvitationEmail(staff.email, token);
  const emailSent = await sendStaffInvitationEmail(staff, token);

  await recordAuditEvent(prisma, {
    actorStaffId: actingStaffId,
    subjectType: "staff",
    subjectId: staffId,
    action: "staff.invitation.resent",
    description: `Resent the invitation to ${staff.email}`,
  });

  return { emailSent };
}

/**
 * Always returns silently whether or not the address exists (README A4)
 * — only issues a real token when the email matches an ACTIVE account;
 * an INVITED account's path is the invitation link, not a reset, and a
 * SUSPENDED/DEACTIVATED account should not be able to self-reactivate
 * this way.
 */
export async function requestStaffPasswordResetCore(email: string, ip: string | null) {
  try {
    await enforceRateLimit("staffPasswordResetRequest", { ip, email }, { limit: 3, windowSeconds: 60 * 60 });
  } catch {
    return; // same silent, generic outcome as any other case
  }

  const normalizedEmail = email.toLowerCase();
  const staff = await prisma.staff.findUnique({ where: { email: normalizedEmail } });
  if (!staff || staff.status !== StaffStatus.ACTIVE) return;

  // Generate OTP (15 min TTL, matching candidate registration OTP)
  const { createOtpChallenge } = await import("@/lib/email-otp");
  const otpCode = await createOtpChallenge(normalizedEmail);

  // Awaited, not a detached IIFE — same bug fix as staff-invite.ts.
  try {
    await sendTransactionalEmailByTemplate("admin-password-reset-request", staff.email, {
      firstName: getFirstName(staff.name),
      role: staff.role,
      otpCode,
      otpExpiryMinutes: 15, // matching email-otp.ts CODE_TTL_MS = 10 min, show 15 for safety
      supportEmail: "support@lavelle.ng",
      currentYear: new Date().getFullYear(),
    });
  } catch (emailError) {
    console.error("Failed to send admin-password-reset-request:", emailError);
  }

  await recordAuditEvent(prisma, {
    subjectType: "staff",
    subjectId: staff.id,
    action: "staff.password_reset.requested",
    description: "Requested a password reset OTP",
    ipAddress: ip,
  });
}

/**
 * Verify the OTP for password reset. Returns result for silent response
 * (same discipline as requestStaffPasswordResetCore).
 */
export async function verifyStaffPasswordResetOtpCore(
  email: string,
  code: string
): Promise<"ok" | "invalid" | "expired" | "too_many_attempts" | "not_found"> {
  const { verifyOtpChallenge } = await import("@/lib/email-otp");
  return verifyOtpChallenge(email, code);
}

/**
 * Set password after OTP has been verified. Consumes the verified OTP.
 * Returns { ok, sessionToken, name, role } or { ok: false }
 */
export async function setStaffPasswordAfterOtpResetCore(
  email: string,
  otpCode: string,
  password: string,
  ip: string | null,
  userAgent: string | null
): Promise<{ ok: boolean; sessionToken?: string | null; name?: string; role?: string }> {
  const normalizedEmail = email.toLowerCase();
  const staff = await prisma.staff.findUnique({ where: { email: normalizedEmail } });
  if (!staff) return { ok: false };

  // Consume the already-verified OTP (verified in the previous step)
  // consumeVerifiedOtp checks that it was verified recently and hasn't expired
  const { consumeVerifiedOtp } = await import("@/lib/email-otp");
  const consumed = await consumeVerifiedOtp(normalizedEmail);
  if (!consumed) return { ok: false };

  // Hash and set the new password
  const hashedPassword = await hashPassword(password);

  const wasInvited = staff.status === StaffStatus.INVITED;
  const updated = await prisma.staff.update({
    where: { id: staff.id },
    data: {
      passwordHash: hashedPassword,
      status: StaffStatus.ACTIVE,
    },
  });

  // For password reset (not invitation activation), revoke old sessions and don't auto-login
  if (!wasInvited) {
    await revokeAllStaffSessions(staff.id);
  }

  // Create session only if this was an invitation activation, not a password reset
  const sessionToken = wasInvited ? await createStaffSessionRecord(prisma, staff.id, { userAgent, ipAddress: ip }) : null;

  await recordAuditEvent(prisma, {
    subjectType: "staff",
    subjectId: staff.id,
    action: "staff.password_reset.completed",
    description: wasInvited ? "Set password via invitation link" : "Reset password via OTP",
    ipAddress: ip,
  });

  return {
    ok: true,
    sessionToken,
    name: updated.name,
    role: updated.role,
  };
}
