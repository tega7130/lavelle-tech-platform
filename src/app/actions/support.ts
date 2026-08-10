"use server";

import { revalidatePath } from "next/cache";
import { Permission, type RequestPriority } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { respondToRequest, resolveRequest, reopenRequest, assignRequest, addCandidateNote, type AssignRequestInput } from "@/lib/support";
import { listAssignableStaff } from "@/lib/support-reads";

function revalidateSupport(requestId: string) {
  revalidatePath(`/admin/support/${requestId}`);
  revalidatePath("/admin/support");
}

/** Thin wrapper so the assign dialog (a Client Component) can fetch the assignee list on open — listAssignableStaff is already self-gated. */
export async function listAssignableStaffAction() {
  return listAssignableStaff();
}

export async function respondToRequestAction(requestId: string, body: string) {
  const staff = await requireStaffPermission(Permission.RESPOND_SUPPORT);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("A message is required.");
  await respondToRequest(requestId, staff.id, trimmed);
  revalidateSupport(requestId);
}

export async function assignRequestAction(requestId: string, staffId: string, priority: RequestPriority, note?: string) {
  const staff = await requireStaffPermission(Permission.RESPOND_SUPPORT);
  const input: AssignRequestInput = { requestId, staffId, priority, note };
  await assignRequest(input, staff.id);
  revalidateSupport(requestId);
}

/** The two-key rule is enforced inside resolveRequest, not here — this only resolves WHO is acting and whether they hold manage_staff (README B5 rule 2: "not by hiding the button"). */
export async function resolveRequestAction(requestId: string) {
  const staff = await requireStaffPermission(Permission.RESPOND_SUPPORT);
  await resolveRequest(requestId, staff.id, staff.permissions.includes(Permission.MANAGE_STAFF));
  revalidateSupport(requestId);
}

export async function reopenRequestAction(requestId: string) {
  const staff = await requireStaffPermission(Permission.RESPOND_SUPPORT);
  await reopenRequest(requestId, staff.id);
  revalidateSupport(requestId);
}

export async function addCandidateNoteAction(candidateId: string, body: string) {
  const staff = await requireStaffPermission(Permission.VIEW_CANDIDATES);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("A note is required.");
  await addCandidateNote(candidateId, staff.id, trimmed);
  revalidatePath(`/admin/candidates/${candidateId}/notes`);
}
