import "server-only";
import crypto from "node:crypto";

function getNombaConfig() {
  const accountId = process.env.NOMBA_ACCOUNT_ID;
  const clientId = process.env.NOMBA_CLIENT_ID;
  const clientSecret = process.env.NOMBA_PRIVATE_KEY; // NOMBA_PRIVATE_KEY is the OAuth client_secret

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Nomba credentials not configured: NOMBA_ACCOUNT_ID, NOMBA_CLIENT_ID, NOMBA_PRIVATE_KEY required");
  }

  return { accountId, clientId, clientSecret };
}

function secret() {
  const s = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!s) throw new Error("PAYMENT_WEBHOOK_SECRET is not set");
  return s;
}

/** HMAC-SHA256 over the raw webhook body — used only by the local /pay/stub dev simulator, not real Nomba deliveries (see verifyNombaWebhookSignature for those). */
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

function nombaWebhookSecret() {
  const s = process.env.NOMBA_WEBHOOK_SECRET;
  if (!s) throw new Error("NOMBA_WEBHOOK_SECRET is not set — set the same signature key configured under Developer > Webhook Setup on the Nomba dashboard.");
  return s;
}

export interface NombaWebhookPayload {
  event_type: string;
  requestId: string;
  data: {
    merchant?: { userId?: string; walletId?: string };
    transaction?: {
      transactionId?: string;
      type?: string;
      time?: string;
      responseCode?: string;
      responseCodeMessage?: string;
      transactionAmount?: number;
      merchantTxRef?: string;
    };
    order?: { orderReference?: string; orderId?: string; amount?: number; customerEmail?: string; currency?: string };
  };
}

/**
 * Nomba's exact HMAC-SHA256 scheme (docs: "Webhook signature verification")
 * — a colon-joined string of specific payload fields plus the delivery
 * timestamp, HMAC'd with the signature key set on the Nomba dashboard and
 * base64-encoded. This is NOT a hash of the raw body, unlike most
 * webhook schemes (including our own /pay/stub simulator above) — Nomba's
 * own reference implementations extract these fields from the parsed
 * payload before hashing.
 */
export function verifyNombaWebhookSignature(payload: NombaWebhookPayload, timestamp: string, signature: string | null): boolean {
  if (!signature) return false;
  const merchant = payload.data.merchant ?? {};
  const transaction = payload.data.transaction ?? {};
  const responseCode = !transaction.responseCode || transaction.responseCode === "null" ? "" : transaction.responseCode;

  const hashingPayload = [
    payload.event_type ?? "",
    payload.requestId ?? "",
    merchant.userId ?? "",
    merchant.walletId ?? "",
    transaction.transactionId ?? "",
    transaction.type ?? "",
    transaction.time ?? "",
    responseCode,
    timestamp,
  ].join(":");

  const expected = crypto.createHmac("sha256", nombaWebhookSecret()).update(hashingPayload).digest("base64");
  const bufA = Buffer.from(expected.toLowerCase());
  const bufB = Buffer.from(signature.toLowerCase());
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface ProviderCheckout {
  checkoutUrl: string;
}

/** Get an access token from Nomba using client credentials. */
async function getNombaAccessToken(): Promise<string> {
  const { accountId, clientId, clientSecret } = getNombaConfig();

  const response = await fetch("https://api.nomba.com/v1/auth/token/issue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accountId,
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Nomba authentication failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as { code?: string; data?: { access_token?: string } };
  const accessToken = data.data?.access_token;

  if (!accessToken) {
    throw new Error("Nomba did not return an access token");
  }

  return accessToken;
}

/** Create a Nomba checkout session and return the hosted payment page URL. */
export async function createProviderCheckout(input: {
  provider: string;
  internalReference: string;
  amountMinor: number;
  candidateEmail: string;
}): Promise<ProviderCheckout> {
  const { accountId } = getNombaConfig();
  const accessToken = await getNombaAccessToken();

  const response = await fetch("https://api.nomba.com/v1/checkout/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      accountId,
    },
    body: JSON.stringify({
      order: {
        amount: (input.amountMinor / 100).toFixed(2),
        currency: "NGN",
        orderReference: input.internalReference,
        customerEmail: input.candidateEmail,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Nomba checkout failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as { code?: string; data?: { checkoutLink?: string } };
  const checkoutUrl = data.data?.checkoutLink;

  if (!checkoutUrl) {
    throw new Error("Nomba API did not return a checkout link");
  }

  return { checkoutUrl };
}

/** Verify payment status with Nomba's API. */
export async function verifyPaymentWithProvider(internalReference: string) {
  const { accountId } = getNombaConfig();
  const accessToken = await getNombaAccessToken();

  const response = await fetch("https://api.nomba.com/v1/transactions/accounts/single?orderReference=" + encodeURIComponent(internalReference), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      accountId,
    },
  });

  if (!response.ok) {
    // If Nomba can't find it, fall back to local DB (might be a webhook that hasn't arrived yet)
    const { prisma } = await import("@/lib/prisma");
    const payment = await prisma.payment.findUnique({ where: { internalReference } });
    if (!payment) return { found: false as const };
    return { found: true as const, status: payment.status, confirmedAt: payment.confirmedAt };
  }

  const data = (await response.json()) as { code?: string; data?: { status?: string } };
  const status = data.data?.status || "pending";

  return { found: true as const, status, confirmedAt: undefined };
}

/** Internal reference shown to the candidate and quoted in support — LVL-PAY-2026-11842. Uniqueness is enforced by the DB constraint; callers retry on conflict. */
export function generateInternalReference(): string {
  const yr = new Date().getFullYear();
  const n = crypto.randomInt(10_000, 99_999);
  return `LVL-PAY-${yr}-${n}`;
}
