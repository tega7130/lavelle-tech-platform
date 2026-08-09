import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The shape stored in Announcement.audienceFilter. Deliberately small —
 * enrolment status plus the same programme/intake dimensions the
 * candidates directory already filters on, not a general query builder.
 */
export interface AudienceFilter {
  enrolmentStatus?: "ALL" | "ENROLLED" | "APPLICANT";
  programmeId?: string;
  intakeId?: string;
}

type Db = typeof prisma | Prisma.TransactionClient;

/** Resolves a filter to the current matching candidate id list — used for both live preview and the frozen send-time snapshot. */
export async function resolveAudience(filter: AudienceFilter, db: Db = prisma) {
  const where: NonNullable<Parameters<typeof prisma.candidate.findMany>[0]>["where"] = {
    AND: [
      filter.enrolmentStatus === "ENROLLED" ? { enrolments: { some: { status: { in: ["ACTIVE", "COMPLETED"] } } } } : {},
      filter.enrolmentStatus === "APPLICANT" ? { enrolments: { none: { status: { in: ["ACTIVE", "COMPLETED"] } } } } : {},
      filter.programmeId ? { enrolments: { some: { programmeId: filter.programmeId } } } : {},
      filter.intakeId ? { enrolments: { some: { cohort: { intakeId: filter.intakeId } } } } : {},
    ],
  };
  return db.candidate.findMany({ where, select: { id: true } });
}
