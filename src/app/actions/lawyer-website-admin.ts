"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { approveLawyerWebsiteVerification, rejectLawyerWebsiteVerification, takeDownLawyerWebsite } from "@/lib/lawyer-website";
import { reasonSchema } from "@/lib/validation/lawyer-website";

function revalidateAll() {
  revalidatePath("/admin/lawyer-websites");
}

export async function approveLawyerWebsiteVerificationAction(verificationId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_LAWYER_WEBSITES);
  const result = await approveLawyerWebsiteVerification(verificationId, staff.id);
  revalidateAll();
  return result;
}

export async function rejectLawyerWebsiteVerificationAction(verificationId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_LAWYER_WEBSITES);
  const parsed = reasonSchema.safeParse({ reason });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid reason.");
  const result = await rejectLawyerWebsiteVerification(verificationId, staff.id, parsed.data.reason);
  revalidateAll();
  return result;
}

export async function takeDownLawyerWebsiteAction(lawyerWebsiteId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_LAWYER_WEBSITES);
  const parsed = reasonSchema.safeParse({ reason });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid reason.");
  const result = await takeDownLawyerWebsite(lawyerWebsiteId, staff.id, parsed.data.reason);
  revalidateAll();
  return result;
}
