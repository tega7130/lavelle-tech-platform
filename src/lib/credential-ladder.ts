import "server-only";
import { getCandidateCredentials } from "@/lib/certificate-candidate-reads";

const TIER_ORDER = ["FOUNDATION", "SPECIALIST", "ADVANCED_PRACTITIONER"] as const;
export type LadderTier = (typeof TIER_ORDER)[number];
export type LadderRungStatus = "completed" | "in_progress" | "locked";

/**
 * Shared by the Dashboard's mini ladder and the full Credentials &
 * Milestones page — completed if a live certificate exists at that tier,
 * in progress if an enrolment without one does yet, otherwise locked.
 */
export async function getCredentialLadder(candidateId: string) {
  const credentials = await getCandidateCredentials(candidateId);
  const certifiedTiers = new Set(credentials.certificates.filter((c) => c.status === "ACTIVE").map((c) => c.tier));
  const inProgressTiers = new Set(credentials.inProgress.map((p) => p.tier));

  const ladder = TIER_ORDER.map((tier) => ({
    tier,
    status: certifiedTiers.has(tier as never)
      ? ("completed" as const)
      : inProgressTiers.has(tier as never)
        ? ("in_progress" as const)
        : ("locked" as const),
  }));

  const latestCertificate = credentials.certificates.find((c) => c.status === "ACTIVE") ?? null;
  return { ladder, latestCertificate, credentials };
}
