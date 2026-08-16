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
/**
 * Withheld = a released sitting that failed (REFER) — issueCertificate
 * refuses anything but a passed sitting (rule in certificate-actions.ts),
 * so these candidates never get a Certificate row at all. They're
 * synthesized here, not stored, so the register can show them alongside
 * real rows without a phantom "certificate" ever existing in the table.
 */
export async function listWithheldCandidates() {
  await requireStaffPermission(Permission.ISSUE_CERTIFICATES);
  const sittings = await prisma.sitting.findMany({
    where: { state: "RELEASED", outcome: "REFER" },
    include: { registration: { include: { candidate: true, exam: { include: { programme: true } } } } },
    orderBy: { releasedAt: "desc" },
  });
  return sittings.map((s) => ({
    id: s.id,
    holderName: `${s.registration.candidate.firstName} ${s.registration.candidate.lastName}`,
    candidateNumber: s.registration.candidate.candidateNumber ?? s.registration.candidate.applicantNumber,
    programmeTitle: s.registration.exam.programme.title,
    tier: s.registration.exam.programme.tier,
    releasedAt: s.releasedAt,
  }));
}

/** Every window whose results have been released — the bulk-issue picker, and how many of its passed sittings are still missing a certificate. */
export async function listReleasedWindowsForBulkIssue() {
  await requireStaffPermission(Permission.ISSUE_CERTIFICATES);
  const sittings = await prisma.sitting.findMany({
    where: { state: "RELEASED", outcome: "PASS" },
    select: {
      certificate: { select: { id: true } },
      registration: {
        select: {
          windowId: true,
          window: { select: { opensAt: true } },
          exam: { select: { programme: { select: { title: true } } } },
        },
      },
    },
  });

  const byWindow = new Map<string, { windowId: string; programmeTitle: string; opensAt: Date; missing: number; total: number }>();
  for (const s of sittings) {
    const key = s.registration.windowId;
    const existing = byWindow.get(key) ?? {
      windowId: key,
      programmeTitle: s.registration.exam.programme.title,
      opensAt: s.registration.window.opensAt,
      missing: 0,
      total: 0,
    };
    existing.total++;
    if (!s.certificate) existing.missing++;
    byWindow.set(key, existing);
  }
  return [...byWindow.values()].sort((a, b) => b.opensAt.getTime() - a.opensAt.getTime());
}

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
