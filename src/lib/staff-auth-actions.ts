import { prisma } from "@/lib/prisma";
import { StaffStatus } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { createStaffSessionRecord } from "@/lib/staff-session";
import { createInvitationTokenRecord, logStaffInvitationEmail, invalidateOutstandingStaffTokens, consumeInvitationToken } from "@/lib/staff-invitation";
import { recordAuditEvent } from "@/lib/audit";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { getFirstName } from "@/lib/email-utils";

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

  const staff = await prisma.staff.findUnique({ where: { email }, include: { permissionGrants: true } });

  // The per-account bucket is checked BEFORE verifying the password, on
  // every attempt — not just failures. A lockout must refuse EVERY
  // further try, including one with the correct password, for the full
  // 15 minutes; checking only on failure would let a legitimate sign-in
  // slip through mid-lockout. Keyed on the submitted email string
  // regardless of whether it matches a real account, so a real and a
  // fake address lock out identically (indistinguishable, rule 1).
  try {
    await enforceRateLimit("staffSignInEmail", { email }, { limit: LOCKOUT_LIMIT, windowSeconds: LOCKOUT_WINDOW_SECONDS });
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

export type SetStaffPasswordResult =
  | { ok: true; sessionToken: string; name: string; role: string }
  | { ok: false };

/**
 * Activation is one transaction (README A5 rule 3): the token is
 * re-validated and consumed, the account's CURRENT status is re-checked
 * (a token issued while INVITED/ACTIVE must not still work after the
 * account was suspended in between), the password is set, and the
 * session is created — all together or none of it, so a partial failure
 * can never consume the token without setting the password.
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

    const sessionToken = await createStaffSessionRecord(tx, staff.id, { userAgent, ipAddress: ip });
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

  const staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff || staff.status !== StaffStatus.ACTIVE) return;

  await invalidateOutstandingStaffTokens(staff.id);
  const token = await createInvitationTokenRecord(prisma, staff.id);
  logStaffInvitationEmail(staff.email, token);

  // Send admin-password-reset-request email asynchronously
  (async () => {
    try {
      const resetPasswordUrl = `${process.env.NEXTAUTH_URL}/staff/set-password?token=${token}`;
      await sendTransactionalEmailByTemplate("admin-password-reset-request", staff.email, {
        firstName: getFirstName(staff.name),
        role: staff.role,
        resetPasswordUrl,
        expiryMinutes: 30,
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
