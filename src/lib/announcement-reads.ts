import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { resolveAudience, type AudienceFilter } from "@/lib/announcement-audience";

export async function listAnnouncements() {
  await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  return prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdByStaff: { select: { name: true } } },
  });
}

export async function getAnnouncement(id: string) {
  await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  return prisma.announcement.findUnique({
    where: { id },
    include: { createdByStaff: { select: { name: true } }, deliveries: true },
  });
}

/** Live recipient count for the composer — NOT what send freezes; just a preview of the filter as it stands right now. */
export async function previewAudience(filter: AudienceFilter) {
  await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  const recipients = await resolveAudience(filter);
  return recipients.length;
}
