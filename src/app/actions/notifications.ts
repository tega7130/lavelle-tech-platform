"use server";

import { getCurrentStaff } from "@/lib/staff-session";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { listStaffNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/staff-notifications";
import {
  listCandidateNotifications,
  markCandidateNotificationRead,
  markAllCandidateNotificationsRead,
} from "@/lib/candidate-notifications";

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

export async function listCandidateNotificationsAction() {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { unreadCount: 0, items: [] };
  return listCandidateNotifications(candidate.id);
}

export async function markCandidateNotificationReadAction(id: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) return;
  await markCandidateNotificationRead(id, candidate.id);
}

export async function markAllCandidateNotificationsReadAction() {
  const candidate = await getCurrentCandidate();
  if (!candidate) return;
  await markAllCandidateNotificationsRead(candidate.id);
}
