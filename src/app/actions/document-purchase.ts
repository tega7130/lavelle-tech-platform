"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@/generated/prisma/client";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { createProviderCheckout } from "@/lib/payment-provider";
import { getSignedAssetUrl } from "@/lib/storage";
import {
  validateAndComputeDiscount,
  resolveDocumentPurchaseForPayment,
  AlreadyOwnedError,
  PurchaseInProgressError,
  DocumentUnavailableError,
} from "@/lib/document-purchase";

/**
 * Standalone preview for the "Have a discount code?" field in the
 * purchase confirmation modal — computes and returns the discounted
 * price so the UI can show "Code applied" and the new total, but this is
 * only ever a preview. It never creates a Payment, and
 * initiateDocumentPurchaseAction re-validates the same code again,
 * independently, at the moment money actually moves.
 */
export async function validateDiscountCodeAction(documentTemplateId: string, code: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");

  const document = await prisma.documentTemplate.findUnique({ where: { id: documentTemplateId } });
  if (!document || !document.isActive) {
    return { valid: false as const, reason: "This document template is no longer available." };
  }

  const result = await validateAndComputeDiscount(document.priceMinor, code, documentTemplateId);
  if (!result.valid) return { valid: false as const, reason: result.reason ?? "Invalid discount code." };
  return { valid: true as const, discountMinor: result.discountMinor!, finalAmountMinor: result.finalAmountMinor! };
}

/**
 * If the provider call throws, the just-created Payment row would
 * otherwise be stuck PENDING forever — same discipline as
 * app/actions/payment.ts's own createCheckoutOrMarkFailed, duplicated
 * here rather than exported/shared since it's a three-line wrapper
 * tied to that file's own Payment shape.
 */
async function createCheckoutOrMarkFailed(payment: { id: string; provider: string; internalReference: string; amountMinor: number }, candidateEmail: string) {
  try {
    return await createProviderCheckout({
      provider: payment.provider,
      internalReference: payment.internalReference,
      amountMinor: payment.amountMinor,
      candidateEmail,
    });
  } catch (e) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    throw e;
  }
}

/**
 * One-click purchase — no cart. Validates the document and (optionally)
 * the discount code server-side, computes the final amount itself
 * (rule 39: the frontend is never trusted for this), creates the PENDING
 * payment + DocumentPurchase row, and returns the Nomba checkout URL to
 * redirect to. Every failure path is caught into one generic message
 * (same reasoning as initiatePayment's own comment) except the specific,
 * safe-to-show cases below.
 */
export async function initiateDocumentPurchaseAction(
  documentTemplateId: string,
  discountCode?: string
): Promise<{ checkoutUrl: string | null; internalReference: string | null; error?: string }> {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");

  try {
    const document = await prisma.documentTemplate.findUnique({ where: { id: documentTemplateId } });
    if (!document || !document.isActive) throw new DocumentUnavailableError();

    let discountMinor = 0;
    let discountCodeId: string | null = null;
    if (discountCode?.trim()) {
      const discount = await validateAndComputeDiscount(document.priceMinor, discountCode, documentTemplateId);
      if (!discount.valid) {
        return { checkoutUrl: null, internalReference: null, error: discount.reason ?? "Invalid discount code." };
      }
      discountMinor = discount.discountMinor!;
      discountCodeId = discount.discountCodeId!;
    }
    const amountMinor = document.priceMinor - discountMinor;

    const { payment } = await resolveDocumentPurchaseForPayment(candidate.id, documentTemplateId, {
      originalPriceMinor: document.priceMinor,
      discountMinor,
      discountCodeId,
      amountMinor,
    });
    const checkout = await createCheckoutOrMarkFailed(payment, candidate.email);

    revalidatePath("/portal/library");
    return { internalReference: payment.internalReference, checkoutUrl: checkout.checkoutUrl };
  } catch (e) {
    if (e instanceof AlreadyOwnedError || e instanceof PurchaseInProgressError || e instanceof DocumentUnavailableError) {
      return { checkoutUrl: null, internalReference: null, error: e.message };
    }
    console.error(`initiateDocumentPurchaseAction failed for candidate ${candidate.id}, document ${documentTemplateId}:`, e);
    return {
      checkoutUrl: null,
      internalReference: null,
      error: "We couldn't start checkout right now. Please try again in a moment, or contact support if this continues.",
    };
  }
}

/**
 * Download and View Online share this one ownership-checked lookup —
 * the only difference is the Cloudinary `attachment` flag. Ownership is
 * re-checked here every time, straight from the DB (never trusted from
 * anything the client sends), and only ever true when purchasedAt is set
 * (rule 16/20/23) — a candidate can never reach another candidate's file
 * by guessing a documentTemplateId, since this query is scoped to their
 * own candidateId.
 */
export async function getDocumentFileAccessAction(documentTemplateId: string, mode: "download" | "view"): Promise<string> {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");

  const owns = await prisma.documentPurchase.findFirst({
    where: { candidateId: candidate.id, documentTemplateId, purchasedAt: { not: null } },
  });
  if (!owns) throw new Error("You have not purchased this document template.");

  const document = await prisma.documentTemplate.findUniqueOrThrow({ where: { id: documentTemplateId } });
  return getSignedAssetUrl(document.storageKey, "raw", 300, mode === "download");
}
