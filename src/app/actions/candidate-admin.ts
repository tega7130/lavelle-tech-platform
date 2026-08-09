"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getClientIp } from "@/lib/request-info";
import { suspendCandidate, reactivateCandidate, updateCandidateDetails } from "@/lib/candidate-status";

export async function updateCandidateDetailsAction(
  candidateId: string,
  data: { firstName: string; lastName: string; phone: string }
) {
  const staff = await requireStaffPermission(Permission.EDIT_CANDIDATE_DETAILS);
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  if (!firstName || !lastName) throw new Error("First and last name are required.");
  const ip = await getClientIp();
  await updateCandidateDetails(candidateId, staff.id, { firstName, lastName, phone: data.phone.trim() || null }, ip);
  revalidatePath(`/admin/candidates/${candidateId}`);
}

export async function suspendCandidateAction(candidateId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.SUSPEND_CANDIDATES);
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  const ip = await getClientIp();
  await suspendCandidate(candidateId, staff.id, trimmed, ip);
  revalidatePath(`/admin/candidates/${candidateId}`);
}

export async function reactivateCandidateAction(candidateId: string) {
  const staff = await requireStaffPermission(Permission.SUSPEND_CANDIDATES);
  const ip = await getClientIp();
  await reactivateCandidate(candidateId, staff.id, ip);
  revalidatePath(`/admin/candidates/${candidateId}`);
}
