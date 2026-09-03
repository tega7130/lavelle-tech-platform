import { prisma } from "@/lib/prisma";
import { StaffStatus } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { createStaffSessionRecord, revokeAllStaffSessions } from "@/lib/staff-session";
import { createInvitationTokenRecord, logStaffInvitationEmail, invalidateOutstandingStaffTokens, consumeInvitationToken, PASSWORD_RESET_TOKEN_TTL_MS } from "@/lib/staff-invitation";
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

  // Fire-and-forget, same discipline as requestStaffPasswordResetCore's
  // email send — a provider hiccup must not fail (or reveal anything
  // about) the request itself.
  (async () => {
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
  })();

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

/** Requires manage_staff (checked by the caller). Resending invalidates every outstanding token first — two live links for one account is a security hole (README A2). */
export async function resendStaffInvitationCore(staffId: string, actingStaffId: string) {
  const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId } });

  await invalidateOutstandingStaffTokens(staffId);
  const token = await createInvitationTokenRecord(prisma, staffId, actingStaffId);
  logStaffInvitationEmail(staff.email, token);

  await recordAuditEvent(prisma, {
    actorStaffId: actingStaffId,
    subjectType: "staff",
    subjectId: staffId,
    action: "staff.invitation.resent",
    description: `Resent the invitation to ${staff.email}`,
  });
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

  await invalidateOutstandingStaffTokens(staff.id);
  const token = await createInvitationTokenRecord(prisma, staff.id, undefined, PASSWORD_RESET_TOKEN_TTL_MS);
  // Not logStaffInvitationEmail — that helper's dev-log URL points at
  // /api/staff/activate (the invitation path), not /staff/reset-password.
  // The real send below already carries the correct resetPasswordUrl.

  // Send admin-password-reset-request email asynchronously
  (async () => {
    try {
      const resetPasswordUrl = `${process.env.NEXTAUTH_URL}/staff/reset-password?token=${token}`;
      await sendTransactionalEmailByTemplate("admin-password-reset-request", staff.email, {
        firstName: getFirstName(staff.name),
        role: staff.role,
        resetPasswordUrl,
        expiryMinutes: PASSWORD_RESET_TOKEN_TTL_MS / 60_000,
        supportEmail: "support@lavelle.ng", // Use a sensible default
        currentYear: new Date().getFullYear(),
      });
    } catch (emailError) {
      console.error("Failed to send admin-password-reset-request:", emailError);
      // Do not fail the password reset request on email errors
    }
  })();

  await recordAuditEvent(prisma, {
    subjectType: "staff",
    subjectId: staff.id,
    action: "staff.password_reset.requested",
    description: "Requested a password reset link",
    ipAddress: ip,
  });
}
