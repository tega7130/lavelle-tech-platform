import "server-only";

/**
 * Canonical base URL for the current deployment. Same NEXTAUTH_URL used
 * throughout the app for absolute links in emails, payment callbacks, and
 * certificate PDFs (see verification-token.ts, payment-provider.ts) — one
 * source so the domain never has to be hardcoded per file, and switching
 * domains (e.g. before the real one is bought) is a single env var change.
 */
export const SITE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/** SITE_URL without the protocol, for inline display text. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
