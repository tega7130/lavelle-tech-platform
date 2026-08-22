"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentCandidate, requireEnrolled } from "@/lib/candidate-session";
import * as playerActions from "@/lib/player-actions";

const stepSchema = z.enum(["content", "scenario", "drafting", "quiz"]);

async function requireCandidateId() {
  const candidate = await getCurrentCandidate();
  requireEnrolled(candidate);
  return candidate.id;
}

export async function completeStepAction(enrolmentId: string, lectureId: string, step: string) {
  const candidateId = await requireCandidateId();
  const parsedStep = stepSchema.parse(step);
  const result = await playerActions.completeStep(candidateId, enrolmentId, lectureId, parsedStep);
  revalidatePath(`/learn/${enrolmentId}/${lectureId}`);
  revalidatePath("/portal/programme");
  return result;
}

export async function submitDraftingAction(enrolmentId: string, lectureId: string) {
  const candidateId = await requireCandidateId();
  const result = await playerActions.submitDrafting(candidateId, enrolmentId, lectureId);
  revalidatePath(`/learn/${enrolmentId}/${lectureId}`);
  revalidatePath("/portal/deadlines");
  return result;
}

export async function startQuizAttemptAction(enrolmentId: string, quizId: string) {
  const candidateId = await requireCandidateId();
  return playerActions.startQuizAttempt(candidateId, enrolmentId, quizId);
}

export async function submitQuizAttemptAction(
  attemptId: string,
  answers: { questionId: string; selectedOptionId: string | null }[]
) {
  const candidateId = await requireCandidateId();
  const result = await playerActions.submitQuizAttempt(candidateId, attemptId, answers);
  revalidatePath("/portal/deadlines");
  revalidatePath("/portal/programme");
  return result;
}

export async function completeProgrammeAction(enrolmentId: string) {
  const candidateId = await requireCandidateId();
  const result = await playerActions.completeProgramme(candidateId, enrolmentId);
  revalidatePath("/portal/programme");
  revalidatePath("/portal/credentials");
  return result;
}

export async function deleteNoteAction(enrolmentId: string, lectureId: string) {
  const candidateId = await requireCandidateId();
  await playerActions.deleteLectureNote(candidateId, enrolmentId, lectureId);
  revalidatePath(`/learn/${enrolmentId}/${lectureId}`);
  revalidatePath("/portal/notes");
}
