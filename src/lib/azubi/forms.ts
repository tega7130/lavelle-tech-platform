import "server-only";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { AZUBI_PRIVACY_VERSION, type AzubiApplicationInput, type AzubiEnquiryInput } from "@/lib/validation/azubi";
import { notifyAzubiTeam } from "@/lib/azubi/notify";

export type AzubiSubmitResult = { ok: true } | { ok: false; error: string };

/**
 * The testable core of the Apply form (build brief section 6): rate-limited
 * on IP + email, honeypot checked by the caller's zod parse (companyWebsite
 * must be empty), then a single insert. No RLS here — this repo has none
 * anywhere; access control is this server-only module plus
 * requireStaffPermission on the admin read side (see src/lib/azubi-reads.ts).
 */
export async function submitAzubiApplicationCore(input: AzubiApplicationInput, ip: string | null): Promise<AzubiSubmitResult> {
  try {
    await enforceRateLimit("azubi_application", { ip, email: input.email }, { limit: 5, windowSeconds: 3600 });
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  await prisma.azubiApplication.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      state: input.state,
      statusKind: input.statusKind,
      institution: input.institution,
      workingMode: input.workingMode,
      areas: input.areas,
      statement: input.statement,
      consentAt: new Date(),
      privacyVersion: AZUBI_PRIVACY_VERSION,
    },
  });

  notifyAzubiTeam(
    `New fellowship application — ${input.fullName}`,
    `<p>New fellowship application from <b>${input.fullName}</b> (${input.email}).</p><p>Status: ${input.statusKind}. Working mode: ${input.workingMode}.</p><p>Review it in the admin portal under Azubi &rsaquo; Applications.</p>`,
    `New fellowship application from ${input.fullName} (${input.email}). Status: ${input.statusKind}. Working mode: ${input.workingMode}. Review it in the admin portal under Azubi > Applications.`
  );

  return { ok: true };
}

/** Shared by the Contact page and the Home page's #contact form (same fields, different `source`). */
export async function submitAzubiEnquiryCore(input: AzubiEnquiryInput, ip: string | null): Promise<AzubiSubmitResult> {
  try {
    await enforceRateLimit("azubi_enquiry", { ip, email: input.email }, { limit: 5, windowSeconds: 3600 });
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  await prisma.azubiEnquiry.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      organisation: input.organisation?.trim() ? input.organisation.trim() : null,
      writingAs: input.writingAs,
      message: input.message,
      consentAt: new Date(),
      privacyVersion: AZUBI_PRIVACY_VERSION,
      source: input.source,
    },
  });

  notifyAzubiTeam(
    `New Azubi enquiry — ${input.fullName}`,
    `<p>New enquiry from <b>${input.fullName}</b> (${input.email}), writing as ${input.writingAs}.</p><p>Review it in the admin portal under Azubi &rsaquo; Enquiries.</p>`,
    `New enquiry from ${input.fullName} (${input.email}), writing as ${input.writingAs}. Review it in the admin portal under Azubi > Enquiries.`
  );

  return { ok: true };
}
