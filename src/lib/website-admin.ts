import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { formatNaira, tierLabel } from "@/lib/format";

export {
  ListingNotFoundError,
  upsertListing,
  checkPublishable,
  publishListing,
  unpublishListing,
  reorderListings,
  PublishCheckError,
  type UpsertListingInput,
  type PublishCheckFailure,
} from "@/lib/website-admin-actions";

/** Admin: every programme, with its listing state — the source for the Website screen's left rail. */
export async function listListings() {
  await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const programmes = await prisma.programme.findMany({
    orderBy: { title: "asc" },
    include: { listing: true },
  });
  return programmes.map((p) => ({
    programmeId: p.id,
    code: p.code,
    title: p.title,
    tier: p.tier,
    tierLabel: tierLabel(p.tier),
    fee: formatNaira(p.feeMinor),
    isPublished: p.listing?.isPublished ?? false,
    hasListing: !!p.listing,
    orderIndex: p.listing?.orderIndex ?? 0,
  }));
}

/**
 * The listing editor's data for one programme. No row is created just
 * by looking — a ProgrammeListing only comes into existence on the
 * first actual save (upsertListing does an upsert), so opening then
 * navigating away leaves no half-created row behind.
 */
export async function getListingForEditor(programmeId: string) {
  await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const programme = await prisma.programme.findUniqueOrThrow({
    where: { id: programmeId },
    include: {
      listing: true,
      modules: { orderBy: { orderIndex: "asc" }, include: { lectures: { orderBy: { orderIndex: "asc" }, select: { title: true } } } },
      assessmentWeightings: true,
    },
  });
  return programme;
}
