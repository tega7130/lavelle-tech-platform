/**
 * Plain nav data (no React/icon deps) — shared between CandidateShell
 * (which adds icon components on top for rendering) and proxy.ts (which
 * needs the gated href list for route-level enforcement, and must not
 * pull client-component modules into the proxy bundle).
 *
 * Gated set per Handoff 00's shell rule: "Dashboard, Catalogue, Profile &
 * ID and Contact us remain" for an applicant — everything else here is
 * gated, including Credentials (Handoff 01's own restatement of this list
 * omits Credentials, but Handoff 00 is the authoritative source for
 * exactly which 4 items stay visible).
 */
export interface CandidateNavItemMeta {
  key: string;
  label: string;
  href: string;
  gated?: boolean;
}

export const CANDIDATE_NAV_ITEMS: CandidateNavItemMeta[] = [
  { key: "dashboard", label: "Dashboard", href: "/portal/dashboard" },
  { key: "programme", label: "Programme", href: "/portal/programme", gated: true },
  { key: "catalogue", label: "Catalogue", href: "/portal/catalogue" },
  { key: "deadlines", label: "Deadlines", href: "/portal/deadlines", gated: true },
  { key: "assessment", label: "Assessment", href: "/portal/assessment", gated: true },
  { key: "exams", label: "Exams", href: "/portal/exams", gated: true },
  { key: "credentials", label: "Credentials", href: "/portal/credentials", gated: true },
  { key: "ai", label: "Lavelle AI", href: "/portal/ai", gated: true },
  { key: "profile", label: "Profile & ID", href: "/portal/profile" },
  { key: "support", label: "Contact us", href: "/portal/support" },
];

export const GATED_PORTAL_HREFS = CANDIDATE_NAV_ITEMS.filter((i) => i.gated).map((i) => i.href);

/** Pure function so proxy.ts's route-gating decision is unit-testable without a running server. */
export function isGatedPortalPath(pathname: string): boolean {
  return GATED_PORTAL_HREFS.some((href) => pathname.startsWith(href));
}
