import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, PaymentStatus, PaymentPurpose, NotificationCategory, DiscountType } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { generateInternalReference } from "@/lib/payment-provider";
import { p2002Target } from "@/lib/prisma-errors";
import { formatNaira } from "@/lib/format";

// No "server-only" discipline issue here despite the import above — same
// as enrolment-transaction.ts, tests/stubs/server-only.ts aliases it to a
// no-op so this file stays directly unit-testable.

function getPaymentProvider(): string {
  const provider = process.env.PAYMENT_PROVIDER || "nomba";
  return provider.toLowerCase();
}

export class AlreadyOwnedError extends Error {
  constructor() {
    super("You already own this document template.");
    this.name = "AlreadyOwnedError";
  }
}

export class PurchaseInProgressError extends Error {
  constructor() {
    super("A payment for this template is already in progress. Please wait a moment and try again.");
    this.name = "PurchaseInProgressError";
  }
}

export class DocumentUnavailableError extends Error {
  constructor() {
    super("This document template is no longer available.");
    this.name = "DocumentUnavailableError";
  }
}

export interface DiscountResult {
  valid: boolean;
  reason?: string;
  discountCodeId?: string;
  discountMinor?: number;
  finalAmountMinor?: number;
}

/**
 * The single source of truth for what a discount code is worth — called
 * both by the standalone "Apply" preview (validateDiscountCodeAction) and,
 * independently, again inside initiateDocumentPurchase at the moment of
 * actual charge. The frontend is never trusted for a discount amount
 * (rule 39) — every call recomputes it here, server-side, from the code's
 * live row.
 */
export async function validateAndComputeDiscount(priceMinor: number, codeInput: string): Promise<DiscountResult> {
  const trimmed = codeInput.trim();
  if (!trimmed) return { valid: false, reason: "Enter a discount code." };

  const code = await prisma.discountCode.findUnique({ where: { code: trimmed } });
  if (!code || !code.isActive) return { valid: false, reason: "Invalid discount code." };
  if (code.expiresAt && code.expiresAt < new Date()) return { valid: false, reason: "This discount code has expired." };
  if (code.maxRedemptions != null && code.redemptionCount >= code.maxRedemptions) {
    return { valid: false, reason: "This discount code has already been fully redeemed." };
  }

  const rawDiscount = code.type === DiscountType.PERCENT ? Math.round((priceMinor * code.value) / 100) : code.value;
  const discountMinor = Math.max(0, Math.min(rawDiscount, priceMinor));

  return { valid: true, discountCodeId: code.id, discountMinor, finalAmountMinor: priceMinor - discountMinor };
}

interface PurchasePricing {
  originalPriceMinor: number;
  discountMinor: number;
  discountCodeId: string | null;
  amountMinor: number;
}

/**
 * Creates the PENDING payment and its linked DocumentPurchase row
 * together — mirrors app/actions/payment.ts's
 * resolveEnrolmentForPayment/createPendingPaymentAndEnrolment retry
 * discipline exactly, including the "one attempt = one transaction, retry
 * outside it" shape a Postgres unique-violation requires (a transaction
 * aborts on the first error; retrying the same transaction after a
 * caught P2002 does not work). An existing row whose latest payment
 * FAILED gets a fresh Payment attached to the SAME row (never a second
 * one — the candidateId+documentTemplateId unique pair forbids it); a row
 * still PENDING blocks a concurrent second attempt; a row with
 * purchasedAt already set is a real, permanent ownership and can never be
 * bought again.
 */
export async function resolveDocumentPurchaseForPayment(candidateId: string, documentTemplateId: string, pricing: PurchasePricing) {
  const existing = await prisma.documentPurchase.findUnique({
    where: { candidateId_documentTemplateId: { candidateId, documentTemplateId } },
    include: { payment: true },
  });

  if (existing) {
    if (existing.purchasedAt) throw new AlreadyOwnedError();
    if (existing.payment.status === PaymentStatus.PENDING) throw new PurchaseInProgressError();

    for (let attempt = 0; attempt < 3; attempt++) {
      const internalReference = generateInternalReference();
      try {
        return await prisma.$transaction(async (tx) => {
          const payment = await tx.payment.create({
            data: {
              candidateId,
              purpose: PaymentPurpose.DOCUMENT_PURCHASE,
              amountMinor: pricing.amountMinor,
              provider: getPaymentProvider(),
              internalReference,
              status: PaymentStatus.PENDING,
            },
          });
          const purchase = await tx.documentPurchase.update({
            where: { id: existing.id },
            data: {
              paymentId: payment.id,
              originalPriceMinor: pricing.originalPriceMinor,
              discountMinor: pricing.discountMinor,
              discountCodeId: pricing.discountCodeId,
              amountMinor: pricing.amountMinor,
            },
          });
          return { purchase, payment };
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && p2002Target(e).includes("internalReference") && attempt < 2) {
          continue; // reference collision — regenerate and retry
        }
        throw e;
      }
    }
    throw new Error("Could not generate a unique payment reference. Try again.");
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const internalReference = generateInternalReference();
    try {
      return await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            candidateId,
            purpose: PaymentPurpose.DOCUMENT_PURCHASE,
            amountMinor: pricing.amountMinor,
            provider: getPaymentProvider(),
            internalReference,
            status: PaymentStatus.PENDING,
          },
        });
        const purchase = await tx.documentPurchase.create({
          data: {
            candidateId,
            documentTemplateId,
            paymentId: payment.id,
            originalPriceMinor: pricing.originalPriceMinor,
            discountMinor: pricing.discountMinor,
            discountCodeId: pricing.discountCodeId,
            amountMinor: pricing.amountMinor,
          },
        });
        return { purchase, payment };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && p2002Target(e).includes("internalReference") && attempt < 2) {
        continue; // reference collision — regenerate and retry
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique payment reference. Try again.");
}

export interface ConfirmDocumentPurchaseResult {
  alreadyConfirmed: boolean;
  purchaseId: string;
  documentTemplateId: string;
  candidate: { id: string; firstName: string; lastName: string; email: string };
  documentTitle: string;
  amountMinor: number;
}

/**
 * The document-purchase counterpart to enrolment-transaction.ts's
 * confirmPayment — deliberately separate, not a third branch bolted onto
 * that function: a document purchase needs none of its enrolment/cohort/
 * ID-card machinery, and bending that function's "one code path" design
 * to an unrelated purpose risks the two paths it already owns. Called
 * only from the verified-webhook path (see /api/webhooks/[provider]) —
 * never from the candidate's return-page redirect (rule 16). Same
 * lock-then-check-idempotency shape as confirmPayment: FOR UPDATE on the
 * Payment row first, so a retried webhook delivery racing itself blocks
 * until the first commits, then sees purchasedAt already set and returns
 * immediately without double-counting revenue or redemptions.
 */
export async function confirmDocumentPurchase(paymentId: string): Promise<ConfirmDocumentPurchaseResult> {
  return prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
    if (!lockedRows[0]) throw new Error(`Payment ${paymentId} not found`);

    const purchase = await tx.documentPurchase.findUnique({
      where: { paymentId },
      include: { candidate: true, documentTemplate: true },
    });
    if (!purchase) throw new Error(`No DocumentPurchase is linked to payment ${paymentId}`);

    const candidateSummary = {
      id: purchase.candidate.id,
      firstName: purchase.candidate.firstName,
      lastName: purchase.candidate.lastName,
      email: purchase.candidate.email,
    };

    if (purchase.purchasedAt) {
      return {
        alreadyConfirmed: true,
        purchaseId: purchase.id,
        documentTemplateId: purchase.documentTemplateId,
        candidate: candidateSummary,
        documentTitle: purchase.documentTemplate.title,
        amountMinor: purchase.amountMinor,
      };
    }

    await tx.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.SUCCESS, confirmedAt: new Date() } });

    const updatedPurchase = await tx.documentPurchase.update({ where: { id: purchase.id }, data: { purchasedAt: new Date() } });

    await tx.documentTemplate.update({
      where: { id: purchase.documentTemplateId },
      data: { purchaseCount: { increment: 1 }, revenueMinor: { increment: purchase.amountMinor } },
    });

    if (purchase.discountCodeId) {
      await tx.discountCode.update({ where: { id: purchase.discountCodeId }, data: { redemptionCount: { increment: 1 } } });
    }

    await tx.notification.create({
      data: {
        candidateId: purchase.candidateId,
        category: NotificationCategory.FINANCE,
        title: "Document purchased",
        body: `Your purchase of "${purchase.documentTemplate.title}" (${formatNaira(purchase.amountMinor)}) is confirmed. It's now in My Purchases.`,
      },
    });

    await recordAuditEvent(tx, {
      subjectType: "document_purchase",
      subjectId: updatedPurchase.id,
      action: "document_purchase.confirmed",
      description: `Purchase of "${purchase.documentTemplate.title}" confirmed for ${formatNaira(purchase.amountMinor)}`,
    });

    return {
      alreadyConfirmed: false,
      purchaseId: updatedPurchase.id,
      documentTemplateId: purchase.documentTemplateId,
      candidate: candidateSummary,
      documentTitle: purchase.documentTemplate.title,
      amountMinor: purchase.amountMinor,
    };
  });
}
