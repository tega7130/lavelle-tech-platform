"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentCandidate, requireEnrolled } from "@/lib/candidate-session";
import * as playerActions from "@/lib/player-actions";
import { NoActiveTemplateError } from "@/lib/certificate-actions";

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

export async function completeProgrammeAction(enrolmentId: string): Promise<{ certificateNumber: string | null; error?: string }> {
  const candidateId = await requireCandidateId();
  try {
    const result = await playerActions.completeProgramme(candidateId, enrolmentId);
    revalidatePath("/portal/programme");
    revalidatePath("/portal/credentials");
    return result;
  } catch (e) {
    // Known, candidate-facing failure modes are returned as data instead of
    // left to throw — a thrown error crossing a Server Action boundary gets
    // its message stripped by Next.js in production (replaced with an
    // opaque "digest" error), same discipline payment.ts already uses for
    // LiveEnrolmentExistsError etc. Anything NOT matched here rethrows and
    // stays opaque to the candidate on purpose — only the server log sees
    // a genuinely unexpected error, same as before this change.
    if (e instanceof playerActions.ProgrammeNotYetCompleteError) return { certificateNumber: null, error: e.message };
    if (e instanceof NoActiveTemplateError) {
      return { certificateNumber: null, error: "Your certificate can't be issued yet — please contact support." };
    }
    throw e;
  }
}

export async function deleteNoteAction(enrolmentId: string, lectureId: string) {
  const candidateId = await requireCandidateId();
  await playerActions.deleteLectureNote(candidateId, enrolmentId, lectureId);
  revalidatePath(`/learn/${enrolmentId}/${lectureId}`);
  revalidatePath("/portal/notes");
}
