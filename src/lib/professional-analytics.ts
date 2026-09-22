import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission, ProfessionalStatus, ExperienceBand } from "@/generated/prisma/client";
import { professionalStatusLabel, experienceBandLabel } from "@/lib/format";

const TOP_N = 10;

export interface Distribution {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface ProfessionalDetailsAnalytics {
  totalCandidates: number;
  profilesWithDetails: number;
  completionRate: number | null;
  byProfessionalStatus: Distribution[];
  byExperienceBand: Distribution[];
  topInstitutions: NamedCount[];
  topOrganisations: NamedCount[];
  yearOfCallByDecade: NamedCount[];
}

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function decadeOf(year: number): string {
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

/**
 * Aggregate view of CandidateProfile's professional-background fields —
 * the same data the candidate-facing "Professional details" step
 * collects (profile-completion-modal.tsx), rolled up across every
 * candidate rather than read one record at a time. Gated on
 * VIEW_CANDIDATES, same as every other candidate-data read in this file's
 * sibling (candidate-admin-reads.ts) and the rest of /admin/analytics.
 */
export async function getProfessionalDetailsAnalytics(): Promise<ProfessionalDetailsAnalytics> {
  await requireStaffPermission(Permission.VIEW_CANDIDATES);

  const [totalCandidates, profilesWithDetails, statusGroups, bandGroups, institutionRows, organisationRows, yearOfCallRows] =
    await Promise.all([
      prisma.candidate.count(),
      prisma.candidateProfile.count({ where: { professionalStatus: { not: null } } }),
      prisma.candidateProfile.groupBy({
        by: ["professionalStatus"],
        where: { professionalStatus: { not: null } },
        _count: true,
      }),
      prisma.candidateProfile.groupBy({
        by: ["experienceBand"],
        where: { experienceBand: { not: null } },
        _count: true,
      }),
      prisma.candidateProfile.groupBy({
        by: ["institution"],
        where: { institution: { not: null } },
        _count: true,
        orderBy: { _count: { institution: "desc" } },
        take: TOP_N,
      }),
      prisma.candidateProfile.groupBy({
        by: ["organisation"],
        where: { organisation: { not: null } },
        _count: true,
        orderBy: { _count: { organisation: "desc" } },
        take: TOP_N,
      }),
      prisma.candidateProfile.findMany({
        where: { yearOfCall: { not: null } },
        select: { yearOfCall: true },
      }),
    ]);

  const statusTotal = statusGroups.reduce((sum, g) => sum + g._count, 0);
  const byProfessionalStatus: Distribution[] = statusGroups
    .map((g) => ({
      key: g.professionalStatus as ProfessionalStatus,
      label: professionalStatusLabel(g.professionalStatus as string),
      count: g._count,
      percent: pct(g._count, statusTotal),
    }))
    .sort((a, b) => b.count - a.count);

  const bandTotal = bandGroups.reduce((sum, g) => sum + g._count, 0);
  // Fixed rank order (not count-sorted) — these are ordered bands, so the
  // display should read as a progression, same as the candidate-facing
  // profile-completion-modal.tsx option list.
  const BAND_ORDER: ExperienceBand[] = ["Y0_2", "Y3_5", "Y6_10", "Y10_PLUS"];
  const bandByKey = new Map(bandGroups.map((g) => [g.experienceBand as ExperienceBand, g._count]));
  const byExperienceBand: Distribution[] = BAND_ORDER.filter((b) => bandByKey.has(b)).map((b) => ({
    key: b,
    label: experienceBandLabel(b),
    count: bandByKey.get(b)!,
    percent: pct(bandByKey.get(b)!, bandTotal),
  }));

  const topInstitutions: NamedCount[] = institutionRows.map((r) => ({ name: r.institution!, count: r._count }));
  const topOrganisations: NamedCount[] = organisationRows.map((r) => ({ name: r.organisation!, count: r._count }));

  const decadeCounts = new Map<string, number>();
  for (const row of yearOfCallRows) {
    const decade = decadeOf(row.yearOfCall!);
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
  }
  const yearOfCallByDecade: NamedCount[] = [...decadeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    totalCandidates,
    profilesWithDetails,
    completionRate: totalCandidates > 0 ? pct(profilesWithDetails, totalCandidates) : null,
    byProfessionalStatus,
    byExperienceBand,
    topInstitutions,
    topOrganisations,
    yearOfCallByDecade,
  };
}
