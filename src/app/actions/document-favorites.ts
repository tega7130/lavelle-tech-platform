"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { toggleFavorite } from "@/lib/candidate-favorites";

export async function toggleFavoriteAction(documentTemplateId: string) {
  const candidate = await getCurrentCandidate();
  if (!candidate) throw new Error("Sign in required.");

  const result = await toggleFavorite(candidate.id, documentTemplateId);
  revalidatePath("/portal/library");
  return result;
}
