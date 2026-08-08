import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission, type CertificateStatus, type ProgrammeTier } from "@/generated/prisma/client";

export interface CertificateFilters {
  status?: CertificateStatus;
  tier?: ProgrammeTier;
  search?: string; // matches certificate number, holder name, or candidate number
}

/** The admin register — never hides a revoked or superseded row, filters only narrow what's shown, they don't hide history. */
export async function listCertificates(filters: CertificateFilters = {}) {
  await requireStaffPermission(Permission.ISSUE_CERTIFICATES);

  const certificates = await prisma.certificate.findMany({
    where: {
      status: filters.status,
      tier: filters.tier,
      ...(filters.search
        ? {
            OR: [
              { certificateNumber: { contains: filters.search, mode: "insensitive" } },
              { holderName: { contains: filters.search, mode: "insensitive" } },
              { candidateNumber: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { issuedAt: "desc" },
    include: { supersededBy: { select: { certificateNumber: true } }, replaces: { select: { certificateNumber: true } } },
  });

  return certificates.map((c) => ({
    id: c.id,
    certificateNumber: c.certificateNumber,
    holderName: c.holderName,
    candidateNumber: c.candidateNumber,
    programmeTitle: c.programmeTitle,
    tier: c.tier,
    band: c.band,
    pathway: c.pathway,
    status: c.status,
    issuedAt: c.issuedAt,
    verificationCount: c.verificationCount,
    revokedReason: c.revokedReason,
    revokedAt: c.revokedAt,
    supersededByNumber: c.supersededBy?.certificateNumber ?? null,
    replacesNumber: c.replaces?.certificateNumber ?? null,
  }));
}

/** The template designer's register — every revision, active or retired, since none are ever deleted. */
export async function listCertificateTemplates() {
  await requireStaffPermission(Permission.ISSUE_CERTIFICATES);
  const templates = await prisma.certificateTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { artworkAsset: { select: { originalFilename: true } }, _count: { select: { certificates: true } } },
  });
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    appliesToTier: t.appliesToTier,
    signatoryBlock: t.signatoryBlock,
    printedFields: t.printedFields as Record<string, boolean>,
    isActive: t.isActive,
    activatedAt: t.activatedAt,
    artworkFilename: t.artworkAsset.originalFilename,
    issuedCount: t._count.certificates,
    createdAt: t.createdAt,
  }));
}
