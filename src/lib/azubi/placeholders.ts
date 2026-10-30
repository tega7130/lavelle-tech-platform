/**
 * Every visible "[... to confirm before launch]" placeholder on the Azubi
 * Privacy/Terms pages, in one place, per build brief section 5. Each needs
 * legal/ops sign-off before launch — see scripts/check-azubi-placeholders.mjs,
 * which fails a production build while any of these are still placeholders
 * (bypass with ALLOW_AZUBI_PLACEHOLDERS=true for previews).
 */
export const AZUBI_PLACEHOLDERS = {
  privacyLastUpdated: "[date to confirm before launch]",
  termsLastUpdated: "[date to confirm before launch]",
  legalEntity: "[legal entity name and registered address: to confirm before launch]",
  hostDataSharing: "[to confirm: exactly what is shared, and when]",
  hostingLocations: "[to confirm: hosting locations]",
  retentionPeriods: "[retention periods for applications and messages: to confirm before launch]",
  cookieList: "[to confirm: list of cookies actually in use]",
  governingLawCourts: "[to confirm with counsel: governing law and courts]",
} as const;

export type AzubiPlaceholderKey = keyof typeof AZUBI_PLACEHOLDERS;
