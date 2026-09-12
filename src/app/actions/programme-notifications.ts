"use server";

import { z } from "zod";
import { subscribeToProgrammeNotification } from "@/lib/programme-notifications";
import { getCurrentCandidate } from "@/lib/candidate-session";

const subscribeSchema = z.object({
  listingId: z.string().trim().min(1),
  email: z.email({ error: "Enter a valid email address." }),
});

export type SubscribeToComingSoonState = { ok: true } | { ok: false; error: string } | null;

/**
 * Public, ungated — the "Notify me" form on a Coming Soon card. A signed-in
 * candidate is linked automatically; a guest just leaves an email.
 */
export async function subscribeToComingSoonAction(
  listingId: string,
  email: string
): Promise<SubscribeToComingSoonState> {
  const parsed = subscribeSchema.safeParse({ listingId, email });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const candidate = await getCurrentCandidate();
  await subscribeToProgrammeNotification(parsed.data.listingId, parsed.data.email, candidate?.id);
  return { ok: true };
}
