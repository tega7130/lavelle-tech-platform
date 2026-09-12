import "server-only";
import { prisma } from "@/lib/prisma";
import { computePercent } from "@/lib/progress";
import { getCurrentCandidate } from "@/lib/candidate-session";

/**
 * Certificates plus in-progress enrolments that haven't earned one yet —
 * the "tier-striped card" screen (gold = awarded, blue = in progress,
 * grey dashed = not started never applies here since an enrolment always
 * implies started). Never hides a revoked or superseded certificate
 * (rule 5 — revocation doesn't restrict what the candidate can see about
 * their own record, only the download).
 */
export async function getCandidateCredentials(candidateId: string) {
  const [certificates, enrolments] = await Promise.all([
    prisma.certificate.findMany({
      where: { candidateId },
      orderBy: { issuedAt: "desc" },
      include: { programme: { select: { code: true } } },
    }),
    prisma.enrolment.findMany({
      where: { candidateId, status: { in: ["ACTIVE", "COMPLETED"] } },
      include: { programme: { select: { id: true, title: true, tier: true, code: true } } },
    }),
  ]);

  const certifiedProgrammeIds = new Set(certificates.map((c) => c.programmeId));
  const inProgress = [];
  for (const enrolment of enrolments) {
    if (certifiedProgrammeIds.has(enrolment.programmeId)) continue; // already has (or is superseded by) a certificate for this programme
    const [completedCount, totalCount] = await Promise.all([
      prisma.lectureProgress.count({ where: { enrolmentId: enrolment.id, state: "COMPLETED" } }),
      prisma.lecture.count({ where: { module: { programmeId: enrolment.programmeId, status: "PUBLISHED" }, status: "PUBLISHED" } }),
    ]);
    inProgress.push({
      enrolmentId: enrolment.id,
      programmeTitle: enrolment.programme.title,
      programmeCode: enrolment.programme.code,
      tier: enrolment.programme.tier,
      percent: computePercent(completedCount, totalCount),
    });
  }

  return {
    certificates: certificates.map((c) => ({
      id: c.id,
      certificateNumber: c.certificateNumber,
      programmeTitle: c.programmeTitle,
      programmeCode: c.programme.code,
      tier: c.tier,
      band: c.band,
      pathway: c.pathway,
      status: c.status,
      finalPercent: c.finalPercent,
      issuedAt: c.issuedAt,
      revokedAt: c.revokedAt,
      revokedReason: c.revokedReason,
      supersededById: c.supersededById,
      replacesId: c.replacesId,
    })),
    inProgress,
  };
}

/** Certificate view (own record only) — resolves either by id or by certificateNumber, whichever the caller has. */
export async function getOwnCertificate(certificateNumber: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return null;
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNumber },
    include: {
      supersededBy: { select: { certificateNumber: true } },
      replaces: { select: { certificateNumber: true } },
      template: { select: { signatoryBlock: true } },
    },
  });
  if (!certificate || certificate.candidateId !== candidate.id) return null;
  return certificate;
}
