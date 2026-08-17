import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationCategory } from "@/generated/prisma/client";

// README E rule 1: every notification must land somewhere actionable —
// this is that mapping. Only SUPPORT is actually emitted for staff today
// (assignRequest in support.ts); the rest are here so any later category
// added to Notification is navigable on day one, not a dead entry.
const CATEGORY_DESTINATION: Record<NotificationCategory, string> = {
  SUPPORT: "/admin/support",
  ASSESSMENT: "/admin/marking",
  FINANCE: "/admin/finance",
  PROGRAMME: "/admin/programmes",
  CREDENTIAL: "/admin/certificates",
  ACCOUNT: "/admin/staff",
  ANNOUNCEMENT: "/admin/announcements",
  EXAMINATION: "/admin/exam-builder",
};

const PANEL_SIZE = 30;

/** README E rule 2: the unread count is derived from readAt on every read, never a stored counter. */
export async function listStaffNotifications(staffId: string) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { staffId }, orderBy: { createdAt: "desc" }, take: PANEL_SIZE }),
    prisma.notification.count({ where: { staffId, readAt: null } }),
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

export async function markNotificationRead(id: string, staffId: string) {
  await prisma.notification.updateMany({ where: { id, staffId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(staffId: string) {
  await prisma.notification.updateMany({ where: { staffId, readAt: null }, data: { readAt: new Date() } });
}
