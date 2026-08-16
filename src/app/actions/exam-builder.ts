"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getClientIp } from "@/lib/request-info";
import * as builder from "@/lib/exam-builder-actions";
import { listExamBank, listExamWindows, listProgrammesWithoutExam, listExamTopics, getQuestionUsage, getExamPreview } from "@/lib/exam-reads";

/** Thin re-export so the builder's client component can refetch the bank after a mutation without a full page navigation. */
export async function listExamBankAction(examId: string) {
  return listExamBank(examId);
}

export async function listExamWindowsAction(examId: string) {
  return listExamWindows(examId);
}

export async function listProgrammesWithoutExamAction() {
  return listProgrammesWithoutExam();
}

export async function getQuestionUsageAction(questionId: string) {
  return getQuestionUsage(questionId);
}

export async function getExamPreviewAction(examId: string) {
  return getExamPreview(examId);
}

export async function createExamAction(programmeId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.createExam(programmeId, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

export async function listExamTopicsAction() {
  return listExamTopics();
}

export async function createStandaloneExamAction(input: builder.CreateStandaloneExamInput) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.createStandaloneExam(input, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

export async function createExamWindowAction(examId: string, input: builder.ExamWindowInput) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.createExamWindow(examId, input, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

export async function updateExamWindowAction(examId: string, windowId: string, input: builder.ExamWindowInput) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.updateExamWindow(examId, windowId, input, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

export async function setExamContentAction(examId: string, input: builder.ExamContentInput) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.setExamContent(examId, input, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  revalidatePath("/portal/exams");
  return result;
}

export async function setExamRequirementsAction(examId: string, requirements: builder.ExamRequirementInput[]) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.setExamRequirements(examId, requirements, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  revalidatePath("/portal/exams");
  return result;
}

export async function closeExamAction(examId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.closeExam(examId, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  revalidatePath("/portal/exams");
  return result;
}

export async function archiveExamAction(examId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.archiveExam(examId, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  revalidatePath("/portal/exams");
  return result;
}

export async function createExamQuestionAction(examId: string, input: builder.CreateExamQuestionInput) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const result = await builder.createExamQuestion(examId, input);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

export async function updateExamQuestionAction(id: string, input: builder.UpdateExamQuestionInput, examId: string) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const result = await builder.updateExamQuestion(id, input);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

export async function retireExamQuestionAction(id: string, reason: string, examId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.retireExamQuestion(id, reason, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

export async function restoreExamQuestionAction(id: string, examId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.restoreExamQuestion(id, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

export async function setExamRulesAction(examId: string, rules: builder.ExamRulesInput) {
  await requireStaffPermission(Permission.MANAGE_EXAMS);
  const result = await builder.setExamRules(examId, rules);
  revalidatePath(`/admin/exam-builder`);
  return result;
}

/**
 * Returns a discriminated result rather than throwing PublishBlockedError
 * across the Server Action boundary — Next.js strips custom error
 * properties (like .issues) from anything that crosses it, keeping only
 * .message, so the structured checklist has to travel as a return value.
 */
export async function publishExamAction(examId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  try {
    const exam = await builder.publishExam(examId, staff.id, ip);
    revalidatePath(`/admin/exam-builder`);
    revalidatePath("/portal/exams");
    return { ok: true as const, exam };
  } catch (e) {
    if (e instanceof builder.PublishBlockedError) return { ok: false as const, issues: e.issues };
    throw e;
  }
}
