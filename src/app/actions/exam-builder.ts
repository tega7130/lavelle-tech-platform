"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getClientIp } from "@/lib/request-info";
import * as builder from "@/lib/exam-builder-actions";
import { listExamBank, listExamWindows } from "@/lib/exam-reads";

/** Thin re-export so the builder's client component can refetch the bank after a mutation without a full page navigation. */
export async function listExamBankAction(examId: string) {
  return listExamBank(examId);
}

export async function listExamWindowsAction(examId: string) {
  return listExamWindows(examId);
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

export async function publishExamAction(examId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_EXAMS);
  const ip = await getClientIp();
  const result = await builder.publishExam(examId, staff.id, ip);
  revalidatePath(`/admin/exam-builder`);
  revalidatePath("/portal/exams");
  return result;
}
