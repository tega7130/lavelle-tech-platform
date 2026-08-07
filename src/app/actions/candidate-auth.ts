"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  registerSchema,
  signInSchema,
  updateProfileSchema,
  fieldErrors,
} from "@/lib/validation/candidate";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/request-info";
import {
  createSessionRecord,
  setSessionCookie,
  createCandidateSession,
  destroyCandidateSession,
  getCurrentCandidate,
} from "@/lib/candidate-session";
import {
  createVerificationTokenRecord,
  logVerificationEmail,
  invalidateOutstandingTokens,
} from "@/lib/verification-token";
import { recordAuditEvent } from "@/lib/audit";
import type { FormActionState } from "@/lib/action-state";

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && v !== "") obj[k] = v;
  return obj;
}

/**
 * Registration creates candidate + profile row + session + verification
 * token in one transaction (Handoff 01 README). A duplicate email returns
 * a field-level error, never a stack trace; the applicant-number sequence
 * is generated inside the transaction with retry-on-conflict as the final
 * arbiter, per the same README.
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
            email: data.email,
            phoneCountryCode: data.phoneCountryCode || "+234",
            phone: data.phone || null,
            passwordHash,
            acceptedTermsAt: new Date(),
            marketingOptIn: data.marketingOptIn,
          },
        });
        await tx.candidateProfile.create({ data: { candidateId: candidate.id } });

        const verificationToken = await createVerificationTokenRecord(tx, candidate.id);
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

        return { candidate, verificationToken, sessionToken };
      });

      await setSessionCookie(result.sessionToken, true);
      logVerificationEmail(result.candidate.email, result.verificationToken);

      return { ok: true, data: { applicantNumber: result.candidate.applicantNumber } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = (e.meta?.target as string[] | undefined) ?? [];
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
    await enforceRateLimit("signIn", { ip, email: raw.email }, { limit: 10, windowSeconds: 15 * 60 });
  } catch (e) {
    if (e instanceof RateLimitError) return { values: raw, message: e.message };
    throw e;
  }

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  const candidate = await prisma.candidate.findUnique({ where: { email: data.email } });
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
  redirect("/portal/dashboard");
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
  return { ok: true };
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
