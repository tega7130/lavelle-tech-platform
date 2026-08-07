import "server-only";
import crypto from "node:crypto";

/**
 * Local dev payment-provider stub. No real Paystack/Flutterwave account is
 * configured for this environment, so "checkout" is a page in this app
 * (/pay/stub) that lets a developer simulate a successful or declined
 * payment — but the CONTRACT is the real one: initiating a payment returns
 * a checkout URL to redirect to, and confirmation arrives exclusively via
 * a signed webhook delivered to /api/webhooks/[provider] (rule 5/6). The
 * stub's "Simulate success" button builds and signs a webhook payload the
 * exact same way a real provider would, then calls the exact same
 * verify-then-process path the real route handler uses — nothing about
 * the confirmation flow is shortcut. Swap createProviderCheckout and
 * verifyPaymentWithProvider for real provider SDK calls to go live;
 * nothing downstream (the webhook handler, the enrolment transaction)
 * needs to change.
 */

function secret() {
  const s = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!s) throw new Error("PAYMENT_WEBHOOK_SECRET is not set");
  return s;
}

/** HMAC-SHA256 over the raw webhook body — the same scheme the webhook route verifies before parsing (rule 5). */
export function signWebhookPayload(rawBody: string): string {
  return crypto.createHmac("sha256", secret()).update(rawBody).digest("hex");
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = signWebhookPayload(rawBody);
  const bufA = Buffer.from(expected);
  const bufB = Buffer.from(signature);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface ProviderCheckout {
  checkoutUrl: string;
}

/**
 * In production this calls the provider's checkout-session API and
 * returns their hosted payment page URL. The local stub has no hosted
 * page to redirect to, so it points at our own /pay/stub instead, passing
 * along exactly what a real checkout session would need to know.
 */
export function createProviderCheckout(input: {
  provider: string;
  internalReference: string;
  amountMinor: number;
  candidateEmail: string;
}): ProviderCheckout {
  const params = new URLSearchParams({
    provider: input.provider,
    ref: input.internalReference,
    amount: String(input.amountMinor),
    email: input.candidateEmail,
  });
  return { checkoutUrl: `/pay/stub?${params.toString()}` };
}

/**
 * Server-to-server verify, for the return-from-provider page and for
 * reconciliation — the return page's actual authority, never the redirect
 * query string (rule 6). In production this is an HTTPS call to the
 * provider's transaction-verify endpoint. The local stub has no separate
 * provider-side ledger to call out to (there is no external provider), so
 * it reads back the Payment row our own signature-verified webhook
 * already wrote — legitimate as a stand-in only because that webhook
 * delivery is itself signed and verified before anything is written, not
 * because this function trusts the caller.
 */
export async function verifyPaymentWithProvider(internalReference: string) {
  const { prisma } = await import("@/lib/prisma");
  const payment = await prisma.payment.findUnique({ where: { internalReference } });
  if (!payment) return { found: false as const };
  return { found: true as const, status: payment.status, confirmedAt: payment.confirmedAt };
}

/** Internal reference shown to the candidate and quoted in support — LVL-PAY-2026-11842. Uniqueness is enforced by the DB constraint; callers retry on conflict. */
export function generateInternalReference(): string {
  const yr = new Date().getFullYear();
  const n = crypto.randomInt(10_000, 99_999);
  return `LVL-PAY-${yr}-${n}`;
}
