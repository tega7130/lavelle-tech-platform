import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { normalizePlaceOfPractice } from "@/lib/location-normalize";

export interface LocationChange {
  from: string;
  to: string;
  count: number;
}

export interface LocationCleanupPreview {
  changes: LocationChange[];
  candidatesAffected: number;
  unmatched: { value: string; count: number }[];
}

/**
 * Groups every distinct raw placeOfPractice value against what
 * normalizePlaceOfPractice() would rewrite it to. Read-only — used both
 * to render the preview table and, unchanged, as the source of truth for
 * applyLocationNormalization() below, so the two can never disagree about
 * what's about to happen.
 */
async function computeChanges() {
  const rows = await prisma.candidateProfile.groupBy({
    by: ["placeOfPractice"],
    where: { placeOfPractice: { not: null } },
    _count: true,
  });

  const changes: LocationChange[] = [];
  const unmatched: { value: string; count: number }[] = [];

  for (const row of rows) {
    const raw = row.placeOfPractice!;
    const normalized = normalizePlaceOfPractice(raw);
    if (normalized && normalized !== raw) {
      changes.push({ from: raw, to: normalized, count: row._count });
    } else if (!normalized) {
      unmatched.push({ value: raw, count: row._count });
    }
  }

  changes.sort((a, b) => b.count - a.count);
  unmatched.sort((a, b) => b.count - a.count);
  return { changes, unmatched };
}

export async function previewLocationCleanup(): Promise<LocationCleanupPreview> {
  await requireStaffPermission(Permission.EDIT_CANDIDATE_DETAILS);
  const { changes, unmatched } = await computeChanges();
  return {
    changes,
    candidatesAffected: changes.reduce((sum, c) => sum + c.count, 0),
    unmatched,
  };
}

/**
 * Applies exactly what previewLocationCleanup() showed — recomputed here
 * rather than trusting a client-submitted list, so a stale preview (data
 * changed between preview and click) can't apply something the staff
 * member never actually saw confirmed.
 */
export async function applyLocationCleanup(): Promise<{ candidatesUpdated: number; changes: LocationChange[] }> {
  const staff = await requireStaffPermission(Permission.EDIT_CANDIDATE_DETAILS);
  const { changes } = await computeChanges();

  let candidatesUpdated = 0;
  for (const change of changes) {
    const result = await prisma.candidateProfile.updateMany({
      where: { placeOfPractice: change.from },
      data: { placeOfPractice: change.to },
    });
    candidatesUpdated += result.count;
  }

  if (candidatesUpdated > 0) {
    await recordAuditEvent(prisma, {
      actorStaffId: staff.id,
      subjectType: "system",
      subjectId: "candidate-locations",
      action: "candidate.locations_normalized",
      description: `Normalized placeOfPractice for ${candidatesUpdated} candidate(s) across ${changes.length} distinct value(s)`,
    });
  }

  return { candidatesUpdated, changes };
}
