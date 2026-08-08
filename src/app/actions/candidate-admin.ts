"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getClientIp } from "@/lib/request-info";
import { suspendCandidate, reactivateCandidate } from "@/lib/candidate-status";

export async function suspendCandidateAction(candidateId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.EDIT_CANDIDATES);
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  const ip = await getClientIp();
  await suspendCandidate(candidateId, staff.id, trimmed, ip);
  revalidatePath(`/admin/candidates/${candidateId}`);
}

export async function reactivateCandidateAction(candidateId: string) {
  const staff = await requireStaffPermission(Permission.EDIT_CANDIDATES);
  const ip = await getClientIp();
  await reactivateCandidate(candidateId, staff.id, ip);
  revalidatePath(`/admin/candidates/${candidateId}`);
}
