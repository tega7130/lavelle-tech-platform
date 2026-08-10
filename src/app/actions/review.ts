"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getClientIp } from "@/lib/request-info";
import { listReviewsForModeration } from "@/lib/review-reads";
import { approveReview, declineReview, unpublishReview } from "@/lib/review-actions";

export async function listReviewsForModerationAction() {
  return listReviewsForModeration();
}

export async function approveReviewAction(reviewId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  const ip = await getClientIp();
  const result = await approveReview(reviewId, staff.id, ip);
  revalidatePath("/admin/reviews");
  return result;
}

export async function declineReviewAction(reviewId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  const ip = await getClientIp();
  const result = await declineReview(reviewId, reason, staff.id, ip);
  revalidatePath("/admin/reviews");
  return result;
}

export async function unpublishReviewAction(reviewId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_ANNOUNCEMENTS);
  const ip = await getClientIp();
  const result = await unpublishReview(reviewId, staff.id, ip);
  revalidatePath("/admin/reviews");
  return result;
}
