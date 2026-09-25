"use server";

import { z } from "zod";
import { subscribeToProgrammeNotification } from "@/lib/programme-notifications";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getClientIp } from "@/lib/request-info";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { PHONE_CODES } from "@/lib/phone-codes";
import { verifyRecaptcha } from "@/lib/recaptcha";

// Matches validation/candidate.ts's EMAIL_RE exactly — same discipline as
// that file's own comment: a plain zod .email() is stricter/looser in
// different edge cases than what the rest of the app accepts.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const EMAIL_MESSAGE = "Enter a valid email address, e.g. you@firm.com";

const VALID_COUNTRY_CODES = new Set(PHONE_CODES.map((c) => c.value));

const subscribeSchema = z.object({
  listingId: z.string().trim().min(1),
  name: z.string({ error: "Enter your name" }).trim().min(1, "Enter your name"),
  phoneCountryCode: z
    .string({ error: "Choose a country code" })
    .refine((v) => VALID_COUNTRY_CODES.has(v), "Choose a country code"),
  phone: z
    .string({ error: "Enter your phone number" })
    .trim()
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 14;
    }, "Enter a valid phone number"),
  email: z.string({ error: EMAIL_MESSAGE }).trim().min(1, EMAIL_MESSAGE).regex(EMAIL_RE, EMAIL_MESSAGE),
});

export type SubscribeToComingSoonState = { ok: true } | { ok: false; error: string } | null;

/**
 * Public, ungated — the "Notify me" form on a Coming Soon card. A signed-in
 * candidate is linked automatically; a guest just leaves their details.
 */
export async function subscribeToComingSoonAction(
  listingId: string,
  name: string,
  phoneCountryCode: string,
  phone: string,
  email: string,
  recaptchaToken?: string
): Promise<SubscribeToComingSoonState> {
  const parsed = subscribeSchema.safeParse({ listingId, name, phoneCountryCode, phone, email });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }

  const ip = await getClientIp();
  try {
    await enforceRateLimit("subscribe_coming_soon", { ip, email: parsed.data.email }, { limit: 10, windowSeconds: 3600 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return { ok: false, error: "Too many subscription attempts. Please try again later." };
    }
    throw e;
  }

  if (!(await verifyRecaptcha(recaptchaToken, "notify_me"))) {
    return { ok: false, error: "Something went wrong. Please refresh and try again." };
  }

  const candidate = await getCurrentCandidate();
  await subscribeToProgrammeNotification(
    parsed.data.listingId,
    parsed.data.email,
    parsed.data.name,
    parsed.data.phoneCountryCode,
    parsed.data.phone,
    candidate?.id
  );
  return { ok: true };
}
