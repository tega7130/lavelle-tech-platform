import "server-only";
import { getCredentialLadder } from "@/lib/credential-ladder";
import { getMilestones } from "@/lib/milestones";
import { tierLabel } from "@/lib/format";

/**
 * Everything the Credentials & Milestones page needs, assembled from the
 * ladder (shared with the Dashboard), the milestones table, and the same
 * credentials data both already read — nothing here is a new source of
 * truth, just composition.
 */
export async function getCredentialsPageData(candidateId: string) {
  const [{ ladder, credentials }, milestones] = await Promise.all([
    getCredentialLadder(candidateId),
    getMilestones(candidateId),
  ]);

  const liveCertificates = credentials.certificates.filter((c) => c.status === "ACTIVE");
  const milestonesEarned = milestones.filter((m) => m.earned).length;

  const highestActive = [...ladder].reverse().find((r) => r.status !== "locked");
  const standingHeadline = highestActive ? `${tierLabel(highestActive.tier)} candidate` : "New candidate";

  const inProgressTier = ladder.find((r) => r.status === "in_progress")?.tier ?? null;
  const nextCertificate = inProgressTier ? (credentials.inProgress.find((p) => p.tier === inProgressTier) ?? null) : null;

  const qualifyingSpecialistCerts = liveCertificates.filter((c) => c.tier === "SPECIALIST" && (c.band === "MERIT" || c.band === "DISTINCTION"));
  const advancedPractitioner = {
    eligible: qualifyingSpecialistCerts.length >= 2,
    held: qualifyingSpecialistCerts.length,
    remaining: Math.max(0, 2 - qualifyingSpecialistCerts.length),
  };

  const standingExplanation = `${liveCertificates.length} certificate${liveCertificates.length === 1 ? "" : "s"} awarded${
    credentials.inProgress.length ? ` and ${credentials.inProgress.length} in progress` : ""
  }. ${
    advancedPractitioner.eligible
      ? "You have satisfied the certificate requirement for the Advanced Practitioner tier."
      : "Two Specialist certificates at Merit or above open the Advanced Practitioner tier."
  }`;

  return {
    ladder,
    certificates: credentials.certificates,
    inProgress: credentials.inProgress,
    totalCreditsEarned: credentials.totalCreditsEarned,
    milestones,
    milestonesEarned,
    standingHeadline,
    standingExplanation,
    nextCertificate,
    advancedPractitioner,
  };
}
