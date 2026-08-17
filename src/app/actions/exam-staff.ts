"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { requireExamAccess } from "@/lib/exam-staff";
import { getClientIp } from "@/lib/request-info";
import * as examStaff from "@/lib/exam-staff";
import { listExamCandidates, getExamSittingDetail } from "@/lib/exam-reads";
import * as markingActions from "@/lib/marking-actions";
import * as sittingActions from "@/lib/exam-sitting-actions";
import { prisma } from "@/lib/prisma";

export async function listExamStaffAssignmentsAction(examId: string) {
  return examStaff.listExamStaffAssignments(examId);
}

export async function listAssignableStaffForExamAction(examId: string) {
  return examStaff.listAssignableStaffForExam(examId);
}

export async function assignExamStaffAction(examId: string, staffId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await examStaff.assignExamStaff(examId, staffId, staff.id, ip);
  revalidatePath(`/admin/exam-builder/${examId}/candidates`);
  return result;
}

export async function unassignExamStaffAction(examId: string, staffId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  await examStaff.unassignExamStaff(examId, staffId, staff.id, ip);
  revalidatePath(`/admin/exam-builder/${examId}/candidates`);
}

export async function listExamCandidatesAction(examId: string) {
  return listExamCandidates(examId);
}

export async function getExamSittingDetailAction(sittingId: string, examId: string) {
  return getExamSittingDetail(sittingId, examId);
}

/**
 * Grading entry point for the exam-scoped candidates page — gated on
 * requireExamAccess(examId), not the blanket MARK_SUBMISSIONS permission,
 * so an exam-assigned staff member without that permission can still
 * grade this exam's written answers. Reuses the exact same
 * claimForMarking/returnMark core (feedback requirement, band
 * resolution, notification, audit) as the main marking queue — this is
 * a second door into the same room, not a second grading system.
 */
export async function claimExamMarkAction(markId: string, examId: string) {
  const staff = await requireExamAccess(examId);
  await assertMarkBelongsToExam(markId, examId);
  const result = await markingActions.claimForMarking(markId, staff.id);
  revalidatePath(`/admin/exam-builder/${examId}/candidates`);
  return result;
}

export async function returnExamMarkAction(markId: string, examId: string, input: markingActions.ReturnMarkInput) {
  const staff = await requireExamAccess(examId);
  await assertMarkBelongsToExam(markId, examId);
  const ip = await getClientIp();
  const result = await markingActions.returnMark(markId, input, staff.id, ip);
  revalidatePath(`/admin/exam-builder/${examId}/candidates`);
  revalidatePath("/admin/marking");
  revalidatePath("/portal/assessment");
  return result;
}

async function assertMarkBelongsToExam(markId: string, examId: string) {
  const mark = await prisma.mark.findUnique({
    where: { id: markId },
    select: { examWrittenAnswer: { select: { sitting: { select: { registration: { select: { examId: true } } } } } } },
  });
  if (mark?.examWrittenAnswer?.sitting.registration.examId !== examId) {
    throw new Error("This mark does not belong to this examination.");
  }
}

/**
 * Release entry point for the exam-scoped candidates page — gated on
 * requireExamAccess(examId), same reasoning as claimExamMarkAction/
 * returnExamMarkAction above, so an exam-assigned staff member without
 * the blanket MARK_SUBMISSIONS permission can release results for the
 * exam they were assigned to. Reuses the exact same releaseResults core
 * (scoring, banding, certificate issuance, candidate notification) as
 * the exam builder's own release button.
 */
export async function releaseExamResultsAction(examId: string, windowId: string) {
  const staff = await requireExamAccess(examId);
  const window = await prisma.examWindow.findUnique({ where: { id: windowId }, select: { examId: true } });
  if (window?.examId !== examId) throw new Error("This sitting does not belong to this examination.");
  const ip = await getClientIp();
  const result = await sittingActions.releaseResults(windowId, staff.id, ip);
  revalidatePath(`/admin/exam-builder/${examId}/candidates`);
  revalidatePath("/admin/exam-builder");
  revalidatePath("/portal/exams");
  return result;
}
