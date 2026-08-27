"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  registerSchema,
  signInSchema,
  requestOtpSchema,
  verifyOtpSchema,
  requestPasswordResetOtpSchema,
  verifyPasswordResetOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updateContactDetailsSchema,
  fieldErrors,
} from "@/lib/validation/candidate";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/request-info";
import {
  createSessionRecord,
  setSessionCookie,
  createCandidateSession,
  destroyCandidateSession,
  revokeAllSessions,
  getCurrentCandidate,
} from "@/lib/candidate-session";
import {
  createVerificationTokenRecord,
  logVerificationEmail,
  invalidateOutstandingTokens,
} from "@/lib/verification-token";
import { createOtpChallenge, logOtpEmail, verifyOtpChallenge, consumeVerifiedOtp } from "@/lib/email-otp";
import {
  createPasswordResetOtpChallenge,
  logPasswordResetOtpEmail,
  verifyPasswordResetOtpChallenge,
  consumeVerifiedPasswordResetOtp,
} from "@/lib/password-reset-otp";
import { recordAuditEvent } from "@/lib/audit";
import { p2002Target } from "@/lib/prisma-errors";
import type { FormActionState } from "@/lib/action-state";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { getFirstName } from "@/lib/email-utils";
import { EMAIL_CONFIG } from "@/lib/email-config";

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && v !== "") obj[k] = v;
  return obj;
}

/**
 * Registration's first step: prove ownership of the email before asking
 * for anything else. No Candidate row exists yet, so a duplicate check
 * happens here too — otherwise someone could OTP-verify an email that's
 * already registered and only discover the conflict at the password step.
 */
export async function requestRegistrationOtp(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const raw = formToObject(formData);
  const ip = await getClientIp();

  try {
    await enforceRateLimit("requestOtp", { ip, email: raw.email }, { limit: 5, windowSeconds: 15 * 60 });
  } catch (e) {
    if (e instanceof RateLimitError) return { values: raw, message: e.message };
    throw e;
  }

  const parsed = requestOtpSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.candidate.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { errors: { email: "An account with this email already exists" }, values: raw };

  const code = await createOtpChallenge(email);
  logOtpEmail(email, code);

  // Send email verification OTP asynchronously
  (async () => {
    try {
      await sendTransactionalEmailByTemplate("email-verification-otp", email, {
        firstName: "",
        otp: code,
        expiryMinutes: 48,
        supportEmail: EMAIL_CONFIG.supportEmail,
        currentYear: new Date().getFullYear(),
      });
    } catch (emailError) {
      console.error("Failed to send email-verification-otp:", emailError);
      // Do not fail the OTP request on email errors
    }
  })();

  // In development, include the code in response for testing without email
  const devCode = process.env.NODE_ENV !== "production" ? code : undefined;
  return { ok: true, data: { otpSent: true, ...(devCode ? { devCode } : {}) } };
}

/** Registration's second step: check the code against the outstanding challenge for that email. */
export async function verifyRegistrationOtp(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const raw = formToObject(formData);
  const ip = await getClientIp();

  try {
    await enforceRateLimit("verifyOtp", { ip, email: raw.email }, { limit: 8, windowSeconds: 15 * 60 });
  } catch (e) {
    if (e instanceof RateLimitError) return { values: raw, message: e.message };
    throw e;
  }

  const parsed = verifyOtpSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const { email, code } = parsed.data;

  const result = await verifyOtpChallenge(email, code);
  if (result === "ok") return { ok: true, data: { verified: true } };

  const messages: Record<string, string> = {
    invalid: "That code is incorrect.",
    expired: "That code has expired. Request a new one.",
    too_many_attempts: "Too many incorrect attempts. Request a new code.",
    not_found: "Request a code first.",
  };
  return { errors: { code: messages[result] }, values: raw };
}

/**
 * Registration creates candidate + profile row + session in one
 * transaction (Handoff 01 README). A duplicate email returns a
 * field-level error, never a stack trace; the applicant-number sequence
 * is generated inside the transaction with retry-on-conflict as the final
 * arbiter, per the same README.
 *
 * Email ownership is proven by OTP before this ever runs (requestRegistrationOtp
 * / verifyRegistrationOtp above) — the old magic-link path stays in place
 * for accounts that predate this, but a fresh registration never sees it:
 * emailVerifiedAt is set at creation, not earned later.
 */
export async function registerCandidate(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const raw = formToObject(formData);
  const ip = await getClientIp();

  try {
    await enforceRateLimit("register", { ip, email: raw.email }, { limit: 5, windowSeconds: 15 * 60 });
  } catch (e) {
    if (e instanceof RateLimitError) return { values: raw, message: e.message };
    throw e;
  }

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  const emailVerified = await consumeVerifiedOtp(data.email);
  if (!emailVerified) {
    return { message: "Please verify your email address first.", values: raw };
  }

  const passwordHash = await hashPassword(data.password);
  const userAgent = await getUserAgent();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          { next_applicant_number: string }[]
        >`SELECT next_applicant_number()`;
        const applicantNumber = rows[0]!.next_applicant_number;

        const candidate = await tx.candidate.create({
          data: {
            applicantNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email.toLowerCase(),
            emailVerifiedAt: new Date(),
            phoneCountryCode: data.phoneCountryCode || "+234",
            phone: data.phone || null,
            passwordHash,
            acceptedTermsAt: new Date(),
            marketingOptIn: data.marketingOptIn,
          },
        });
        await tx.candidateProfile.create({ data: { candidateId: candidate.id } });

        const sessionToken = await createSessionRecord(tx, candidate.id, {
          userAgent,
          ipAddress: ip,
        });

        await recordAuditEvent(tx, {
          subjectType: "candidate",
          subjectId: candidate.id,
          action: "candidate.registered",
          description: `Registered as ${applicantNumber}`,
          ipAddress: ip,
        });

        return { candidate, sessionToken };
      });

      await setSessionCookie(result.sessionToken, true);

      await sendTransactionalEmailByTemplate(
        'account-welcome',
        result.candidate.email,
        {
          firstName: getFirstName(result.candidate.firstName),
          exploreProgrammesUrl: `${process.env.NEXTAUTH_URL}/programmes`,
          currentYear: new Date().getFullYear(),
        }
      );

      redirect("/portal/dashboard");
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = p2002Target(e);
        if (target.includes("email")) {
          return { errors: { email: "An account with this email already exists" }, values: raw };
        }
        if (target.includes("applicantNumber") && attempt < 2) continue; // retry — README's "let the unique constraint be the final arbiter"
      }
      throw e;
    }
  }
  return { values: raw, message: "Something went wrong. Please try again." };
}

/**
 * A suspended account gets a distinct result the UI renders as the amber
 * state, not a generic "invalid credentials" (Handoff 01 README) — it
 * does NOT create a session. Everyone else: records last_login_at,
 * creates the session, and redirects into the shell.
 */
export async function signInCandidate(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const raw = formToObject(formData);
  const ip = await getClientIp();

  try {
    await enforceRateLimit("signIn", { ip, email: raw.email }, { limit: 5, windowSeconds: 5 * 60 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return { values: raw, message: "Too many attempts. Try again in 5 minutes." };
    }
    throw e;
  }

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  const candidate = await prisma.candidate.findUnique({ where: { email: data.email.toLowerCase() } });
  const invalid: FormActionState = { values: raw, message: "Incorrect email or password." };
  if (!candidate) return invalid;
  if (!(await verifyPassword(data.password, candidate.passwordHash))) return invalid;

  if (candidate.accountStatus === "SUSPENDED") {
    return {
      values: raw,
      data: {
        suspended: true,
        suspendedReason: candidate.suspendedReason,
        suspendedAt: candidate.suspendedAt?.toISOString() ?? null,
      },
    };
  }

  await prisma.candidate.update({ where: { id: candidate.id }, data: { lastLoginAt: new Date() } });
  await createCandidateSession(candidate.id, data.remember);
  // README H3 rule 16: expiry must return the candidate to where they
  // were, not a bare dashboard — `next` only ever came from proxy.ts's
  // own redirect (a same-origin /portal path), never taken at face value
  // from an open field.
  const next = raw.next;
  redirect(next && next.startsWith("/portal/") ? next : "/portal/dashboard");
}

export async function signOutCandidate() {
  await destroyCandidateSession();
  redirect("/sign-in?signedOut=1");
}

export async function resendVerification(): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };
  if (candidate.emailVerifiedAt) return { ok: true };

  const ip = await getClientIp();
  try {
    await enforceRateLimit(
      "resendVerification",
      { ip, email: candidate.email },
      { limit: 3, windowSeconds: 60 * 60 }
    );
  } catch (e) {
    if (e instanceof RateLimitError) return { message: e.message };
    throw e;
  }

  await invalidateOutstandingTokens(candidate.id);
  const token = await createVerificationTokenRecord(prisma, candidate.id);
  logVerificationEmail(candidate.email, token);

  // Send email-verification-otp email asynchronously
  (async () => {
    try {
      const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
      await sendTransactionalEmailByTemplate("email-verification-otp", candidate.email, {
        firstName: getFirstName(candidate.firstName),
        verificationUrl: verifyUrl,
        expiryHours: Math.floor(48),
        supportEmail: EMAIL_CONFIG.supportEmail,
        currentYear: new Date().getFullYear(),
      });
    } catch (emailError) {
      console.error("Failed to send email-verification-otp:", emailError);
      // Do not fail the resend on email errors
    }
  })();

  return { ok: true };
}

/**
 * Forgot-password step 1: prove ownership of the account's email via OTP
 * before allowing a new password. Silent on an unknown email or a
 * non-ACTIVE account — same "never reveal whether the address exists"
 * rule as requestStaffPasswordResetCore, just expressed as a generic
 * FormActionState success instead of a bare return.
 */
export async function requestPasswordResetOtp(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const raw = formToObject(formData);
  const ip = await getClientIp();

  try {
    await enforceRateLimit(
      "requestPasswordResetOtp",
      { ip, email: raw.email },
      { limit: 3, windowSeconds: 60 * 60 }
    );
  } catch {
    // Same silent, generic outcome as any other case — a lockout must not
    // reveal whether the address exists either.
    return { ok: true, data: { otpSent: true } };
  }

  const parsed = requestPasswordResetOtpSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const email = parsed.data.email.toLowerCase();

  const candidate = await prisma.candidate.findUnique({ where: { email } });
  if (candidate && candidate.accountStatus === "ACTIVE") {
    const code = await createPasswordResetOtpChallenge(candidate.id);
    logPasswordResetOtpEmail(email, code);

    // Send password-reset-request email asynchronously
    (async () => {
      try {
        const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?email=${encodeURIComponent(email)}`;
        await sendTransactionalEmailByTemplate("password-reset-request", email, {
          firstName: getFirstName(candidate.firstName),
          resetPasswordUrl: resetUrl,
          supportEmail: EMAIL_CONFIG.supportEmail,
          currentYear: new Date().getFullYear(),
        });
      } catch (emailError) {
        console.error("Failed to send password-reset-request:", emailError);
        // Do not fail the reset request on email errors
      }
    })();

    const devCode = process.env.NODE_ENV !== "production" ? code : undefined;
    return { ok: true, data: { otpSent: true, ...(devCode ? { devCode } : {}) } };
  }

  return { ok: true, data: { otpSent: true } };
}

/** Forgot-password step 2: check the code against the outstanding challenge for that email. */
export async function verifyPasswordResetOtp(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const raw = formToObject(formData);
  const ip = await getClientIp();

  try {
    await enforceRateLimit("verifyPasswordResetOtp", { ip, email: raw.email }, { limit: 8, windowSeconds: 15 * 60 });
  } catch (e) {
    if (e instanceof RateLimitError) return { values: raw, message: e.message };
    throw e;
  }

  const parsed = verifyPasswordResetOtpSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const { email, code } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const messages: Record<string, string> = {
    invalid: "That code is incorrect.",
    expired: "That code has expired. Request a new one.",
    too_many_attempts: "Too many incorrect attempts. Request a new code.",
    not_found: "Request a code first.",
  };

  // Same address unknown either way — resolving to a candidate row here,
  // not before the rate limit above, keeps that check indistinguishable
  // from an "invalid code" reply.
  const candidate = await prisma.candidate.findUnique({ where: { email: normalizedEmail } });
  if (!candidate) return { errors: { code: messages.not_found }, values: raw };

  const result = await verifyPasswordResetOtpChallenge(candidate.id, code);
  if (result === "ok") return { ok: true, data: { verified: true } };

  return { errors: { code: messages[result] }, values: raw };
}

/**
 * Forgot-password step 3: sets the new password once the OTP has been
 * verified, revokes every existing session for the account (a reset must
 * end every live sign-in, not just the browser doing the resetting), then
 * signs the candidate back in on this device — the same auto-login shape
 * as registerCandidate's post-registration session.
 */
export async function resetPasswordWithOtp(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const raw = formToObject(formData);
  const ip = await getClientIp();

  try {
    await enforceRateLimit("resetPasswordWithOtp", { ip, email: raw.email }, { limit: 5, windowSeconds: 60 * 60 });
  } catch (e) {
    if (e instanceof RateLimitError) return { values: raw, message: e.message };
    throw e;
  }

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  const candidate = await prisma.candidate.findUnique({ where: { email: data.email.toLowerCase() } });
  if (!candidate) return { message: "Please verify your email address first.", values: raw };

  const otpVerified = await consumeVerifiedPasswordResetOtp(candidate.id);
  if (!otpVerified) return { message: "Please verify your email address first.", values: raw };

  const passwordHash = await hashPassword(data.password);
  const userAgent = await getUserAgent();

  await prisma.candidate.update({ where: { id: candidate.id }, data: { passwordHash } });
  await revokeAllSessions(candidate.id); // ends every session, including any still open elsewhere

  const sessionToken = await createSessionRecord(prisma, candidate.id, { userAgent, ipAddress: ip });
  await setSessionCookie(sessionToken, true);

  await recordAuditEvent(prisma, {
    subjectType: "candidate",
    subjectId: candidate.id,
    action: "candidate.password_reset.completed",
    description: "Reset password via OTP",
    ipAddress: ip,
  });

  redirect("/portal/dashboard");
}

/**
 * The profile-completion modal's output. Every field optional — Skip is
 * always allowed, and saving is partial (Handoff 01 rule: profile
 * completion is entirely optional).
 */
export async function updateProfile(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const raw = formToObject(formData);
  const parsed = updateProfileSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  // Plain scalars only (never a Prisma FieldUpdateOperations wrapper), so
  // the same object is valid for both the create and update branches of
  // the upsert despite their slightly different generated input types.
  const fields: Record<string, unknown> = {};
  if (data.professionalStatus !== undefined) fields.professionalStatus = data.professionalStatus;
  if (data.yearOfCall !== undefined) fields.yearOfCall = data.yearOfCall;
  if (data.scnNumber !== undefined) fields.scnNumber = data.scnNumber;
  if (data.institution !== undefined) fields.institution = data.institution;
  if (data.graduationYear !== undefined) fields.graduationYear = data.graduationYear;
  if (data.organisation !== undefined) fields.organisation = data.organisation;
  if (data.roleTitle !== undefined) fields.roleTitle = data.roleTitle;
  if (data.experienceBand !== undefined) fields.experienceBand = data.experienceBand;
  if (data.placeOfPractice !== undefined) fields.placeOfPractice = data.placeOfPractice;
  if (data.photoUrl !== undefined) fields.photoUrl = data.photoUrl;
  if (data.handbookAcknowledged) fields.handbookAcknowledgedAt = new Date();
  if (data.complete) fields.completedAt = new Date();

  await prisma.candidateProfile.upsert({
    where: { candidateId: candidate.id },
    create: { candidateId: candidate.id, ...fields } as Prisma.CandidateProfileUncheckedCreateInput,
    update: fields as Prisma.CandidateProfileUpdateInput,
  });

  revalidatePath("/portal/dashboard");
  return { ok: true };
}

/**
 * The Profile & ID page's editable identity fields — name, email, phone.
 * Candidate ID (applicant/candidate number) is never editable here, it's
 * generated and permanent (Handoff 01 rule). A changed email still has to
 * be unique — same P2002 -> field-error mapping as registration.
 */
export async function updateCandidateContactDetails(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const raw = formToObject(formData);
  const parsed = updateContactDetailsSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  try {
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { email: data.email, phone: data.phone ?? null },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && p2002Target(e).includes("email")) {
      return { errors: { email: "Another account already uses this email" }, values: raw };
    }
    throw e;
  }

  revalidatePath("/portal/profile");
  revalidatePath("/portal/dashboard");
  return { ok: true };
}
