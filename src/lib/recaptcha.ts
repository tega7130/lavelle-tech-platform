import "server-only";

const MIN_SCORE = 0.5;
const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/**
 * Verifies a reCAPTCHA v3 token server-side before a sensitive action
 * proceeds (sign-in, registration, checkout, contact forms — see
 * useRecaptchaToken's callers). Deliberately fails OPEN when
 * RECAPTCHA_SECRET_KEY isn't set: this lets the feature roll out safely
 * even before the env var is set on every environment (Vercel env vars
 * are set by hand, separately from a code deploy — see SUPPORT_EMAIL's
 * same rollout shape) rather than locking every candidate/staff member
 * out of sign-in the moment this ships. Once the key IS set, a missing,
 * expired, low-score, or wrong-action token fails closed (rejected).
 */
export async function verifyRecaptcha(token: string | null | undefined, expectedAction: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean; score?: number; action?: string; "error-codes"?: string[] };
    console.log("[recaptcha debug]", JSON.stringify(data), "expected action:", expectedAction);
    return data.success === true && (data.score ?? 0) >= MIN_SCORE && data.action === expectedAction;
  } catch (error) {
    console.error("reCAPTCHA verification request failed:", error);
    // The Google API itself being unreachable is not the candidate's
    // fault — degrade to unprotected rather than an outage blocking
    // every sign-in/registration on the platform.
    return true;
  }
}
