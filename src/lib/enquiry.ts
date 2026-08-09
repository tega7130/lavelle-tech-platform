import "server-only";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

export interface EnquiryInput {
  name: string;
  email: string;
  phone?: string;
  programmeOfInterestCode?: string;
  message: string;
}

export type SubmitEnquiryResult = { ok: true; reference: string } | { ok: false; error: string };

/**
 * The testable core of the contact form (rule 8): rate-limited on IP and
 * email, then creates BOTH a ContactEnquiry (the marketing-site record)
 * and a SupportRequest with no candidateId (an anonymous visitor has no
 * candidate account) so it surfaces in the Slice 08 desk immediately.
 * Takes `ip` as an explicit param — the caller resolves it via
 * next/headers, which this function can't reach outside a request.
 */
export async function submitEnquiryCore(input: EnquiryInput, ip: string | null): Promise<SubmitEnquiryResult> {
  try {
    await enforceRateLimit("enquiry", { ip, email: input.email }, { limit: 5, windowSeconds: 3600 });
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const programme = input.programmeOfInterestCode
    ? await prisma.programme.findUnique({ where: { code: input.programmeOfInterestCode }, select: { id: true } })
    : null;

  const enquiry = await prisma.$transaction(async (tx) => {
    const request = await tx.supportRequest.create({
      data: {
        candidateId: null,
        guestName: input.name,
        guestEmail: input.email,
        subject: `Website enquiry from ${input.name}`,
        category: "ENQUIRY",
        body: input.message,
      },
    });
    return tx.contactEnquiry.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        programmeOfInterestId: programme?.id ?? null,
        message: input.message,
        supportRequestId: request.id,
      },
    });
  });

  return { ok: true, reference: `LVL-ENQ-${enquiry.id.slice(0, 8).toUpperCase()}` };
}
