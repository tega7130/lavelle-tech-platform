import type { GradeBand, CredentialPathway } from "@/generated/prisma/client";
import type { listCertificates } from "@/lib/certificate-reads";

type Certificates = Awaited<ReturnType<typeof listCertificates>>;

// No "server-only" here, deliberately — these are pure aggregations over
// an already-fetched, already-permission-gated certificates array
// (listCertificates itself requires ISSUE_CERTIFICATES), not a second DB
// round trip. Keeping the math out of the gate means it's plain-Vitest-
// testable with fixture data, same discipline as src/lib/progress.ts.

export interface CertificateStats {
  totalIssued: number; // every row ever created, active or not — an issuance event is never undone, only revoked/superseded
  active: number;
  revoked: number;
  superseded: number;
  totalVerifications: number;
  bandCounts: Record<GradeBand, number>; // among ACTIVE certificates only — a revoked one shouldn't count toward "how well are candidates doing"
  pathwayCounts: Record<CredentialPathway, number>;
}

export function computeCertificateStats(certificates: Certificates): CertificateStats {
  const bandCounts: Record<GradeBand, number> = { DISTINCTION: 0, MERIT: 0, PASS: 0, REFER: 0 };
  const pathwayCounts: Record<CredentialPathway, number> = { PATHWAY: 0, EXAMINATION_ONLY: 0 };

  let active = 0;
  let revoked = 0;
  let superseded = 0;
  let totalVerifications = 0;

  for (const c of certificates) {
    totalVerifications += c.verificationCount;
    if (c.status === "ACTIVE") {
      active++;
      bandCounts[c.band]++;
      pathwayCounts[c.pathway]++;
    } else if (c.status === "REVOKED") revoked++;
    else if (c.status === "SUPERSEDED") superseded++;
  }

  return { totalIssued: certificates.length, active, revoked, superseded, totalVerifications, bandCounts, pathwayCounts };
}

export interface MonthlyIssuance {
  monthKey: string; // "2026-02"
  label: string; // "February 2026"
  count: number;
}

/** Issuance volume by calendar month, oldest first — every row counts once, at its original issuedAt, regardless of later revocation/supersession. */
export function computeIssuanceTimeline(certificates: Certificates): MonthlyIssuance[] {
  const byMonth = new Map<string, number>();
  for (const c of certificates) {
    const d = new Date(c.issuedAt);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([monthKey, count]) => {
      const [year, month] = monthKey.split("-").map(Number);
      const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
      return { monthKey, label, count };
    });
}
