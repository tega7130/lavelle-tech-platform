"use server";

import { revalidatePath } from "next/cache";
import { Permission, type RequestPriority, type RequestCategory } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import {
  respondToRequest,
  resolveRequest,
  reopenRequest,
  assignRequest,
  addCandidateNote,
  submitCandidateRequest,
  submitCandidateReply,
  type AssignRequestInput,
} from "@/lib/support";
import { listAssignableStaff, listMyRequests, getMyRequestThread } from "@/lib/support-reads";

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

/** Any staff member with RESPOND_SUPPORT permission can resolve a ticket. */
export async function resolveRequestAction(requestId: string) {
  const staff = await requireStaffPermission(Permission.RESPOND_SUPPORT);
  await resolveRequest(requestId, staff.id);
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

// ── Candidate-facing (Slice 11 Part F) ──────────────────────────────────

export async function listMyRequestsAction() {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");
  return listMyRequests(candidate.id);
}

export async function getMyRequestThreadAction(requestId: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");
  return getMyRequestThread(requestId, candidate.id);
}

export async function submitCandidateRequestAction(input: { subject: string; category: RequestCategory; body: string }) {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");
  const request = await submitCandidateRequest(candidate.id, input);
  revalidatePath("/portal/support");
  return request;
}

export async function submitCandidateReplyAction(requestId: string, body: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");
  const trimmed = body.trim();
  if (!trimmed) throw new Error("A message is required.");
  await submitCandidateReply(requestId, candidate.id, trimmed);
  revalidatePath("/portal/support");
}
