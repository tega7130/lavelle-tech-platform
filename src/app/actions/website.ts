"use server";

import { z } from "zod";
import { getClientIp } from "@/lib/request-info";
import { submitEnquiryCore } from "@/lib/enquiry";

const enquirySchema = z.object({
  name: z.string().trim().min(1, { error: "Enter your full name." }),
  email: z.email({ error: "Enter a valid email address." }),
  phone: z.string().trim().optional(),
  programmeOfInterestCode: z.string().trim().optional(),
  message: z.string().trim().min(1, { error: "Let us know what you'd like to ask." }),
  // Honeypot — a real visitor never sees or fills this field (hidden by CSS
  // on the form); a bot filling every input trips it. Silently accepted,
  // never written, so the sender learns nothing from the response.
  website: z.string().optional(),
});

export type SubmitEnquiryState = { ok: true; reference: string } | { ok: false; error: string } | null;

export async function submitEnquiry(_prev: SubmitEnquiryState, formData: FormData): Promise<SubmitEnquiryState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = enquirySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const { website, ...input } = parsed.data;

  if (website) {
    // Honeypot tripped — pretend success so the bot doesn't learn to
    // leave this field blank, but write nothing.
    return { ok: true, reference: "LVL-ENQ-0000" };
  }

  const ip = await getClientIp();
  return submitEnquiryCore(input, ip);
}
