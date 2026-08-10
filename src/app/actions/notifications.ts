"use server";

import { getCurrentStaff } from "@/lib/staff-session";
import { listStaffNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/staff-notifications";

export async function listStaffNotificationsAction() {
  const staff = await getCurrentStaff();
  if (!staff) return { unreadCount: 0, items: [] };
  return listStaffNotifications(staff.id);
}

export async function markNotificationReadAction(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) return;
  await markNotificationRead(id, staff.id);
}

export async function markAllNotificationsReadAction() {
  const staff = await getCurrentStaff();
  if (!staff) return;
  await markAllNotificationsRead(staff.id);
}
