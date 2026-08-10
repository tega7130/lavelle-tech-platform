"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getClientIp } from "@/lib/request-info";
import { listInvigilationWindows, listInvigilationSittings, getSittingConductDetail } from "@/lib/invigilation-reads";
import { clearSitting, referSitting } from "@/lib/invigilation-actions";

export async function listInvigilationWindowsAction() {
  return listInvigilationWindows();
}

export async function listInvigilationSittingsAction(windowId: string) {
  return listInvigilationSittings(windowId);
}

export async function getSittingConductDetailAction(sittingId: string) {
  return getSittingConductDetail(sittingId);
}

export async function clearSittingAction(sittingId: string, finding: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await clearSitting(sittingId, finding, staff.id, ip);
  revalidatePath("/admin/invigilation");
  return result;
}

export async function referSittingAction(sittingId: string, finding: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await referSitting(sittingId, finding, staff.id, ip);
  revalidatePath("/admin/invigilation");
  return result;
}
