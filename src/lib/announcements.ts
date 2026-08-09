import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { resolveAudience, type AudienceFilter } from "@/lib/announcement-audience";
import type { Channel, Prisma } from "@/generated/prisma/client";

export class NoChannelsError extends Error {
  constructor() {
    super("An announcement needs at least one delivery channel.");
    this.name = "NoChannelsError";
  }
}

export class AlreadySentError extends Error {
  constructor() {
    super("This announcement has already been sent and cannot be withdrawn.");
    this.name = "AlreadySentError";
  }
}

export async function composeAnnouncement(params: {
  staffId: string;
  title: string;
  body: string;
  audienceFilter: AudienceFilter;
  channels: Channel[];
}) {
  if (params.channels.length === 0) throw new NoChannelsError();
  return prisma.announcement.create({
    data: {
      title: params.title,
      body: params.body,
      audienceFilter: params.audienceFilter as unknown as Prisma.InputJsonValue,
      channels: params.channels,
      createdByStaffId: params.staffId,
      state: "DRAFT",
    },
  });
}

export async function scheduleAnnouncement(announcementId: string, scheduledFor: Date) {
  const announcement = await prisma.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  if (announcement.channels.length === 0) throw new NoChannelsError();
  return prisma.announcement.update({ where: { id: announcementId }, data: { state: "SCHEDULED", scheduledFor } });
}

/**
 * Resolves the audience ONCE and freezes it as AnnouncementDelivery rows
 * — one per recipient per channel (rule 8). Re-resolving the filter
 * later (e.g. after more candidates enrol) would silently change who
 * "received" a past announcement, so nothing downstream ever
 * re-evaluates audienceFilter after this point.
 */
export async function sendAnnouncement(announcementId: string, staffId: string) {
  const announcement = await prisma.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  if (announcement.channels.length === 0) throw new NoChannelsError();

  const recipients = await resolveAudience(announcement.audienceFilter as AudienceFilter);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.announcementDelivery.createMany({
      data: recipients.flatMap((r) =>
        announcement.channels.map((channel) => ({ announcementId, candidateId: r.id, channel, deliveredAt: now }))
      ),
      skipDuplicates: true,
    });
    await tx.announcement.update({
      where: { id: announcementId },
      data: { state: "SENT", sentAt: now, recipientCount: recipients.length },
    });
    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "announcement",
      subjectId: announcementId,
      action: "announcement.sent",
      description: `Sent "${announcement.title}" to ${recipients.length} candidate${recipients.length === 1 ? "" : "s"} on ${announcement.channels.length} channel${announcement.channels.length === 1 ? "" : "s"}`,
    });
  });

  return { recipientCount: recipients.length };
}

/** Only DRAFT/SCHEDULED announcements can be withdrawn — once SENT, deliveries are a historical record and stay put (rule 8). */
export async function withdrawAnnouncement(announcementId: string, staffId: string) {
  const announcement = await prisma.announcement.findUniqueOrThrow({ where: { id: announcementId } });
  if (announcement.state === "SENT") throw new AlreadySentError();

  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({ where: { id: announcementId }, data: { state: "WITHDRAWN" } });
    await recordAuditEvent(tx, {
      actorStaffId: staffId,
      subjectType: "announcement",
      subjectId: announcementId,
      action: "announcement.withdrawn",
      description: `Withdrew "${announcement.title}" before it was sent`,
    });
  });
}
