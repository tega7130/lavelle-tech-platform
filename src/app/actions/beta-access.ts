"use server";

import { getCurrentCandidate } from "@/lib/candidate-session";
import { BetaFeature, BetaFeedbackKind } from "@/generated/prisma/client";
import { shouldShowCompletionFeedback, submitBetaFeedback } from "@/lib/beta-gate";

export async function shouldShowBetaCompletionFeedbackAction(feature: BetaFeature): Promise<boolean> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return false;
  return shouldShowCompletionFeedback(candidate.id, feature);
}

export async function submitBetaFeedbackAction(feature: BetaFeature, kind: BetaFeedbackKind, message: string): Promise<void> {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");
  await submitBetaFeedback(candidate.id, feature, kind, message);
}
