"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getClientIp } from "@/lib/request-info";
import * as markingActions from "@/lib/marking-actions";
import { openMarkable } from "@/lib/marking-reads";

/** Thin re-export so the marking queue's client component can fetch a detail pane on selection without a full page navigation. */
export async function openMarkableAction(markId: string) {
  return openMarkable(markId);
}

export async function claimForMarkingAction(markId: string) {
  const staff = await requireStaffPermission(Permission.GRADE_ASSESSMENTS);
  const result = await markingActions.claimForMarking(markId, staff.id);
  revalidatePath("/admin/marking");
  return result;
}

export async function returnMarkAction(markId: string, input: markingActions.ReturnMarkInput) {
  const staff = await requireStaffPermission(Permission.GRADE_ASSESSMENTS);
  const ip = await getClientIp();
  const result = await markingActions.returnMark(markId, input, staff.id, ip);
  revalidatePath("/admin/marking");
  revalidatePath("/portal/assessment");
  return result;
}

export async function requestResubmissionAction(markId: string, input: markingActions.RequestResubmissionInput) {
  const staff = await requireStaffPermission(Permission.GRADE_ASSESSMENTS);
  const ip = await getClientIp();
  const result = await markingActions.requestResubmission(markId, input, staff.id, ip);
  revalidatePath("/admin/marking");
  return result;
}

export async function moderateMarkAction(markId: string, input: markingActions.ModerateMarkInput) {
  const staff = await requireStaffPermission(Permission.MODERATE_MARKS);
  const ip = await getClientIp();
  const result = await markingActions.moderateMark(markId, input, staff.id, ip);
  revalidatePath("/admin/marking");
  revalidatePath("/portal/assessment");
  return result;
}
