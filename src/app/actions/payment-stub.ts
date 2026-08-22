"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signWebhookPayload } from "@/lib/payment-provider";
import { prisma } from "@/lib/prisma";

/**
 * Fires a genuinely signed webhook at our own /api/webhooks/[provider]
 * route over a real HTTP request — the same request shape, header and
 * signature scheme a real provider's server would use — so simulating a
 * payment in dev exercises the exact confirmation path production will,
 * not a shortcut around it.
 */
async function deliverWebhook(provider: string, event: "charge.success" | "charge.failed", reference: string, failureReason?: string) {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const body = JSON.stringify({
    event,
    data: { reference, providerEventId: crypto.randomUUID(), ...(failureReason ? { failureReason } : {}) },
  });
  const signature = signWebhookPayload(body);
  await fetch(`${proto}://${host}/api/webhooks/${provider}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-lavelle-signature": signature },
    body,
  });
}

/**
 * EXAMINATION_FEE payments return to their own exam-flavoured status page,
 * not the enrolment one. A guest checkout ("Apply for this programme",
 * paid before any account existed) has no session to reach a /portal
 * page with, so it returns to a public page instead, carrying the
 * GuestCheckout's own secret token — never taken from the incoming
 * redirect, always looked up fresh off the payment row (rule 6).
 */
async function returnPathFor(reference: string) {
  const payment = await prisma.payment.findUnique({
    where: { internalReference: reference },
    select: { purpose: true, guestCheckout: { select: { checkoutToken: true } } },
  });
  if (payment?.guestCheckout) return `/checkout/return/${reference}?token=${payment.guestCheckout.checkoutToken}`;
  return payment?.purpose === "EXAMINATION_FEE" ? `/portal/exams/checkout/${reference}` : `/portal/checkout/${reference}`;
}

export async function simulateProviderSuccess(provider: string, reference: string) {
  await deliverWebhook(provider, "charge.success", reference);
  redirect(await returnPathFor(reference));
}

export async function simulateProviderDecline(provider: string, reference: string) {
  await deliverWebhook(provider, "charge.failed", reference, "Card declined by issuing bank.");
  redirect(await returnPathFor(reference));
}
