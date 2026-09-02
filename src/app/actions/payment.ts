"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, Permission, PaymentPurpose, PaymentStatus, EnrolmentStatus } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getClientIp } from "@/lib/request-info";
import { recordAuditEvent } from "@/lib/audit";
import { createProviderCheckout, generateInternalReference } from "@/lib/payment-provider";
import { LiveEnrolmentExistsError, PaymentNotPendingError, ProgrammeNotOpenError, assertProgrammeOpenForEnrolment } from "@/lib/payment-errors";
import { applyOfflineRecording } from "@/lib/offline-recording";
import { offlinePaymentInputSchema, recordOfflinePaymentSchema, fieldErrors } from "@/lib/validation/payment";
import { guestCheckoutSchema } from "@/lib/validation/candidate";
import { getPaymentStatus, getGuestCheckoutStatus } from "@/lib/catalogue-reads";
import { p2002Target } from "@/lib/prisma-errors";
import { hashPassword } from "@/lib/password";
import { consumeVerifiedOtp } from "@/lib/email-otp";
import crypto from "node:crypto";
import type { FormActionState } from "@/lib/action-state";

/** Thin Server Action wrapper so the checkout return page's client-side poll can call the server function (rule 6 — this, not the redirect URL, is the authority). */
export async function pollPaymentStatus(internalReference: string) {
  return getPaymentStatus(internalReference);
}

/** Same, for the unauthenticated guest-checkout return page — scoped by checkoutToken instead of a session. */
export async function pollGuestCheckoutStatus(internalReference: string, checkoutToken: string) {
  return getGuestCheckoutStatus(internalReference, checkoutToken);
}

// Keeps empty strings (unlike programme.ts's formToObject, which filters
// them for optional-field semantics) — every field on this form is
// required, and zod's own min(1, "message") needs an actual "" to report
// that friendly message; a missing key instead fails on the base type
// check first ("expected string, received undefined") and never reaches it.
function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}

async function createPendingPaymentAndEnrolment(candidateId: string, programmeId: string, feeMinor: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const internalReference = generateInternalReference();
    try {
      return await prisma.$transaction(async (tx) => {
        const enrolment = await tx.enrolment.create({
          data: { candidateId, programmeId, status: EnrolmentStatus.PENDING_PAYMENT },
        });
        const payment = await tx.payment.create({
          data: {
            candidateId,
            purpose: PaymentPurpose.PROGRAMME_FEE,
            enrolmentId: enrolment.id,
            amountMinor: feeMinor,
            provider: "paystack",
            internalReference,
            status: PaymentStatus.PENDING,
          },
        });
        return { enrolment, payment };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = p2002Target(e);
        if (target.includes("internalReference") && attempt < 2) continue; // reference collision — regenerate and retry
        throw new LiveEnrolmentExistsError(); // the partial unique index caught an existing live enrolment
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique payment reference. Try again.");
}

/**
 * A PENDING_PAYMENT enrolment whose latest payment attempt FAILED is
 * abandoned, not live — the candidate must be able to try again, and a
 * second enrolment row would collide with the one-live-enrolment-per-
 * programme index anyway. Retrying reuses that same enrolment and adds a
 * fresh Payment row rather than creating a second enrolment.
 */
async function resolveEnrolmentForPayment(candidateId: string, programmeId: string, feeMinor: number) {
  const existing = await prisma.enrolment.findFirst({
    where: { candidateId, programmeId, status: { notIn: [EnrolmentStatus.WITHDRAWN, EnrolmentStatus.REFUNDED] } },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!existing) return createPendingPaymentAndEnrolment(candidateId, programmeId, feeMinor);

  const latestStatus = existing.payments[0]?.status;
  if (existing.status !== EnrolmentStatus.PENDING_PAYMENT || latestStatus !== PaymentStatus.FAILED) {
    throw new LiveEnrolmentExistsError();
  }
  const payment = await createRetryPayment(existing.id, candidateId, feeMinor);
  return { enrolment: existing, payment };
}

async function createRetryPayment(enrolmentId: string, candidateId: string, feeMinor: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const internalReference = generateInternalReference();
    try {
      return await prisma.payment.create({
        data: {
          candidateId,
          purpose: PaymentPurpose.PROGRAMME_FEE,
          enrolmentId,
          amountMinor: feeMinor,
          provider: "paystack",
          internalReference,
          status: PaymentStatus.PENDING,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = p2002Target(e);
        if (target.includes("internalReference") && attempt < 2) continue; // reference collision — regenerate and retry
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique payment reference. Try again.");
}

/** Creates the PENDING payment and PENDING_PAYMENT enrolment together; rejects if a live enrolment already exists. */
export async function initiatePayment(programmeId: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");

  const programme = await prisma.programme.findUniqueOrThrow({ where: { id: programmeId } });
  assertProgrammeOpenForEnrolment(programme);

  const { payment } = await resolveEnrolmentForPayment(candidate.id, programmeId, programme.feeMinor);
  const checkout = await createProviderCheckout({
    provider: payment.provider,
    internalReference: payment.internalReference,
    amountMinor: payment.amountMinor,
    candidateEmail: candidate.email,
  });

  revalidatePath("/portal/catalogue");
  return { internalReference: payment.internalReference, checkoutUrl: checkout.checkoutUrl };
}

/**
 * "Apply for this programme" checkout-first flow — no candidate exists
 * yet. Creates a Payment (candidateId null) and a linked GuestCheckout
 * holding the applicant's details; confirmPayment's guest branch turns
 * this into a real Candidate + Enrolment the moment the webhook confirms
 * success (never before — an abandoned payment leaves no account behind).
 * Email ownership is proven by the same OTP challenge registration uses,
 * consumed here exactly as registerCandidate consumes it.
 */
export async function initiateGuestCheckout(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const raw: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") raw[k] = v;

  const parsed = guestCheckoutSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  const emailVerified = await consumeVerifiedOtp(data.email);
  if (!emailVerified) return { message: "Please verify your email address first.", values: raw };

  const existingCandidate = await prisma.candidate.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existingCandidate) {
    return { errors: { email: "An account with this email already exists" }, values: raw };
  }

  const programme = await prisma.programme.findUniqueOrThrow({ where: { id: data.programmeId } });
  try {
    assertProgrammeOpenForEnrolment(programme);
  } catch (e) {
    if (e instanceof ProgrammeNotOpenError) return { message: e.message, values: raw };
    throw e;
  }

  const passwordHash = await hashPassword(data.password);
  const checkoutToken = crypto.randomBytes(24).toString("hex");

  for (let attempt = 0; attempt < 3; attempt++) {
    const internalReference = generateInternalReference();
    try {
      const payment = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            purpose: PaymentPurpose.PROGRAMME_FEE,
            amountMinor: programme.feeMinor,
            provider: "paystack",
            internalReference,
            status: PaymentStatus.PENDING,
          },
        });
        await tx.guestCheckout.create({
          data: {
            programmeId: programme.id,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            passwordHash,
            emailVerifiedAt: new Date(),
            acceptedTermsAt: new Date(),
            marketingOptIn: data.marketingOptIn,
            checkoutToken,
            paymentId: payment.id,
          },
        });
        return payment;
      });

      const checkout = await createProviderCheckout({
        provider: payment.provider,
        internalReference: payment.internalReference,
        amountMinor: payment.amountMinor,
        candidateEmail: data.email,
      });
      return { ok: true, data: { checkoutUrl: checkout.checkoutUrl } };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && p2002Target(e).includes("internalReference") && attempt < 2) {
        continue; // reference collision — regenerate and retry
      }
      throw e;
    }
  }
  return { values: raw, message: "Could not generate a unique payment reference. Try again." };
}

/** Finance ledger / candidate record entry point — a pending payment already exists. Irreversible; requires confirm-payments. */
export async function confirmPaymentManually(paymentId: string, _prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const staff = await requireStaffPermission(Permission.CONFIRM_PAYMENTS);
  const raw = formToObject(formData);
  const parsed = offlinePaymentInputSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const ip = await getClientIp();
  try {
    const result = await applyOfflineRecording(paymentId, parsed.data, staff.id, ip);
    revalidatePath("/admin/finance");
    return { ok: true, data: result };
  } catch (e) {
    if (e instanceof PaymentNotPendingError) return { message: e.message };
    throw e;
  }
}

/** Candidate record entry point for someone who transferred before ever starting checkout — no pending payment row exists yet. */
export async function recordOfflinePayment(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const staff = await requireStaffPermission(Permission.CONFIRM_PAYMENTS);
  const raw = formToObject(formData);
  const parsed = recordOfflinePaymentSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  const programme = await prisma.programme.findUniqueOrThrow({ where: { id: data.programmeId } });

  let payment;
  try {
    ({ payment } = await resolveEnrolmentForPayment(data.candidateId, data.programmeId, programme.feeMinor));
  } catch (e) {
    if (e instanceof LiveEnrolmentExistsError) return { message: e.message };
    throw e;
  }

  const ip = await getClientIp();
  const result = await applyOfflineRecording(payment.id, data, staff.id, ip);
  revalidatePath("/admin/finance");
  revalidatePath(`/admin/candidates/${data.candidateId}`);
  return { ok: true, data: result };
}

/** Status and audit-log update only — Lavelle holds no candidate balances; the refund itself is settled outside the platform (rule 10). */
export async function markEnrolmentRefunded(enrolmentId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_FINANCE);
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required.");

  const ip = await getClientIp();
  const updated = await prisma.$transaction(async (tx) => {
    const enrolment = await tx.enrolment.update({
      where: { id: enrolmentId },
      data: { status: EnrolmentStatus.REFUNDED, refundedAt: new Date(), statusReason: trimmedReason },
    });
    await recordAuditEvent(tx, {
      actorStaffId: staff.id,
      subjectType: "enrolment",
      subjectId: enrolmentId,
      action: "enrolment.refunded",
      description: "Enrolment marked refunded",
      reason: trimmedReason,
      ipAddress: ip,
    });
    return enrolment;
  });

  revalidatePath("/admin/finance");
  return updated;
}

/** Retires the current card and creates a successor with reissuedFromId, so the history stays legible. */
export async function reissueIdCard(candidateId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.EDIT_CANDIDATE_DETAILS);
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required.");

  const current = await prisma.idCard.findFirst({ where: { candidateId, retiredAt: null } });
  if (!current) throw new Error("This candidate has no active ID card to reissue.");

  const ip = await getClientIp();
  const successor = await prisma.$transaction(async (tx) => {
    await tx.idCard.update({ where: { id: current.id }, data: { retiredAt: new Date() } });
    const created = await tx.idCard.create({
      data: {
        candidateId,
        cardNumber: current.cardNumber,
        tier: current.tier,
        issuedAt: new Date(),
        validUntil: current.validUntil,
        reissuedFromId: current.id,
      },
    });
    await recordAuditEvent(tx, {
      actorStaffId: staff.id,
      subjectType: "id_card",
      subjectId: created.id,
      action: "id_card.reissued",
      description: `Reissued ID card for candidate ${candidateId}`,
      reason: trimmedReason,
      ipAddress: ip,
    });
    return created;
  });

  revalidatePath(`/admin/candidates/${candidateId}`);
  return successor;
}
