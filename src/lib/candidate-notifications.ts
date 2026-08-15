import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationCategory } from "@/generated/prisma/client";

// Every notification must land somewhere actionable (README E rule 1,
// mirrored here for the candidate side) — this is that mapping.
const CATEGORY_DESTINATION: Record<NotificationCategory, string> = {
  ACCOUNT: "/portal/profile",
  CREDENTIAL: "/portal/credentials",
  PROGRAMME: "/portal/programme",
  ASSESSMENT: "/portal/assessment",
  FINANCE: "/portal/dashboard",
  SUPPORT: "/portal/support",
  ANNOUNCEMENT: "/portal/dashboard",
};

const PANEL_SIZE = 30;

/** Unread count is derived from readAt on every read, never a stored counter — same rule as the staff inbox. */
export async function listCandidateNotifications(candidateId: string) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { candidateId }, orderBy: { createdAt: "desc" }, take: PANEL_SIZE }),
    prisma.notification.count({ where: { candidateId, readAt: null } }),
  ]);

  return {
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      unread: !n.readAt,
      createdAt: n.createdAt,
      href: CATEGORY_DESTINATION[n.category],
    })),
  };
}

export async function markCandidateNotificationRead(id: string, candidateId: string) {
  await prisma.notification.updateMany({ where: { id, candidateId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllCandidateNotificationsRead(candidateId: string) {
  await prisma.notification.updateMany({ where: { candidateId, readAt: null }, data: { readAt: new Date() } });
}
