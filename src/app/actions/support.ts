"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { respondToRequest, resolveRequest, addCandidateNote } from "@/lib/support";

export async function respondToRequestAction(requestId: string, body: string) {
  const staff = await requireStaffPermission(Permission.RESPOND_SUPPORT);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("A message is required.");
  await respondToRequest(requestId, staff.id, trimmed);
  revalidatePath(`/admin/support/${requestId}`);
  revalidatePath("/admin/support");
}

export async function resolveRequestAction(requestId: string) {
  const staff = await requireStaffPermission(Permission.RESPOND_SUPPORT);
  await resolveRequest(requestId, staff.id);
  revalidatePath(`/admin/support/${requestId}`);
  revalidatePath("/admin/support");
}

export async function addCandidateNoteAction(candidateId: string, body: string) {
  const staff = await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("A note is required.");
  await addCandidateNote(candidateId, staff.id, trimmed);
  revalidatePath(`/admin/candidates/${candidateId}/notes`);
}
