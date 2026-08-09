"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getClientIp } from "@/lib/request-info";
import * as sittingActions from "@/lib/exam-sitting-actions";
import { getExamPaymentStatus } from "@/lib/exam-candidate-reads";

/** Thin wrapper so the exam checkout return page's client-side poll can call the server function (rule 6 — this, not the redirect URL, is the authority). */
export async function pollExamPaymentStatus(internalReference: string) {
  return getExamPaymentStatus(internalReference);
}

async function requireCandidate() {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");
  return candidate;
}

export async function registerForExamAction(examId: string, windowId: string) {
  const candidate = await requireCandidate();
  const result = await sittingActions.registerForExam(examId, windowId, candidate.id, candidate.email);
  revalidatePath("/portal/exams");
  return result;
}

export async function startSittingAction(registrationId: string) {
  const candidate = await requireCandidate();
  return sittingActions.startSitting(registrationId, candidate.id);
}

export async function submitSittingAction(sittingId: string) {
  const candidate = await requireCandidate();
  const result = await sittingActions.submitSitting(sittingId, candidate.id);
  revalidatePath("/portal/exams");
  return result;
}

export async function forfeitSittingAction(sittingId: string) {
  const candidate = await requireCandidate();
  const result = await sittingActions.forfeitSitting(sittingId, candidate.id);
  revalidatePath("/portal/exams");
  return result;
}

export async function expireSittingIfOverdueAction(sittingId: string) {
  const candidate = await requireCandidate();
  return sittingActions.expireSittingIfOverdue(sittingId, candidate.id);
}

// A requireEnrolled-style gate isn't right for any of the actions above
// — sitting an exam is explicitly available to exam-only candidates too
// (rule 14), who have no enrolment to require. Auth alone
// (requireCandidate) is the correct gate; per-exam eligibility is
// enforced inside registerForExam itself.

export async function releaseResultsAction(windowId: string) {
  const staff = await requireStaffPermission(Permission.MARK_SUBMISSIONS);
  const ip = await getClientIp();
  const result = await sittingActions.releaseResults(windowId, staff.id, ip);
  revalidatePath("/admin/exam-builder");
  revalidatePath("/portal/exams");
  return result;
}
