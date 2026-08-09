"use server";

import { revalidatePath } from "next/cache";
import { Permission, Channel } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { composeAnnouncement, scheduleAnnouncement, sendAnnouncement, withdrawAnnouncement } from "@/lib/announcements";
import { previewAudience } from "@/lib/announcement-reads";
import type { AudienceFilter } from "@/lib/announcement-audience";

export async function previewAudienceAction(filter: AudienceFilter) {
  return previewAudience(filter);
}

export async function composeAnnouncementAction(params: { title: string; body: string; audienceFilter: AudienceFilter; channels: Channel[] }) {
  const staff = await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  const title = params.title.trim();
  const body = params.body.trim();
  if (!title || !body) throw new Error("Title and body are required.");
  const announcement = await composeAnnouncement({ staffId: staff.id, title, body, audienceFilter: params.audienceFilter, channels: params.channels });
  revalidatePath("/admin/announcements");
  return announcement;
}

export async function scheduleAnnouncementAction(announcementId: string, scheduledFor: Date) {
  await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  await scheduleAnnouncement(announcementId, scheduledFor);
  revalidatePath("/admin/announcements");
}

export async function sendAnnouncementAction(announcementId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  const result = await sendAnnouncement(announcementId, staff.id);
  revalidatePath("/admin/announcements");
  return result;
}

export async function withdrawAnnouncementAction(announcementId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  await withdrawAnnouncement(announcementId, staff.id);
  revalidatePath("/admin/announcements");
}
