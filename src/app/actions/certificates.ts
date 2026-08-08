"use server";

import { revalidatePath } from "next/cache";
import { Permission } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { auth } from "@/lib/auth";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { getClientIp } from "@/lib/request-info";
import { prisma } from "@/lib/prisma";
import { getSignedCertificatePdfUrl } from "@/lib/certificate-pdf";
import * as certActions from "@/lib/certificate-actions";
import * as templateActions from "@/lib/certificate-template-actions";
import { listCertificates, listCertificateTemplates, type CertificateFilters } from "@/lib/certificate-reads";

/**
 * Either the certificate's own candidate, or any signed-in staff member
 * (viewing from the admin register) may mint a download link — a plain
 * NextAuth peek rather than requireStaffPermission, since no specific
 * permission is named for "can staff view a certificate PDF" and the
 * link itself carries no more authority than a 5-minute signed GET.
 */
export async function getCertificateDownloadUrlAction(certificateId: string) {
  const [candidate, session] = await Promise.all([getCurrentCandidate(), auth()]);
  const isStaff = !!session?.user && session.user.userType === "staff";
  if (!candidate && !isStaff) throw new Error("Sign in required.");

  if (candidate) {
    const certificate = await prisma.certificate.findUniqueOrThrow({ where: { id: certificateId } });
    if (certificate.candidateId !== candidate.id) throw new Error("This does not belong to you.");
  }

  return getSignedCertificatePdfUrl(certificateId);
}

export async function listCertificatesAction(filters: CertificateFilters = {}) {
  return listCertificates(filters);
}

export async function listCertificateTemplatesAction() {
  return listCertificateTemplates();
}

export interface ManualIssueFormInput {
  candidateEmail: string;
  programmeCode: string;
  enrolmentId?: string | null;
  finalPercent: number;
  band: certActions.ManualIssueInput["band"];
  reason: string;
}

/** Human-typed edge-case entry point — resolves email/code to ids here, keeping the core lib function itself id-based and testable. */
export async function issueCertificateManuallyAction(input: ManualIssueFormInput) {
  const staff = await requireStaffPermission(Permission.ISSUE_CERTIFICATES);
  const ip = await getClientIp();

  const candidate = await prisma.candidate.findUnique({ where: { email: input.candidateEmail.trim() } });
  if (!candidate) throw new Error("No candidate found with that email.");
  const programme = await prisma.programme.findUnique({ where: { code: input.programmeCode.trim().toUpperCase() } });
  if (!programme) throw new Error("No programme found with that code.");

  const result = await certActions.issueCertificateManually(
    {
      candidateId: candidate.id,
      programmeId: programme.id,
      enrolmentId: input.enrolmentId ?? null,
      finalPercent: input.finalPercent,
      band: input.band,
      reason: input.reason,
    },
    staff.id,
    ip
  );
  revalidatePath("/admin/certificates");
  revalidatePath("/portal/credentials");
  return result;
}

export async function revokeCertificateAction(id: string, reason: string) {
  const staff = await requireStaffPermission(Permission.REVOKE_CERTIFICATES);
  const ip = await getClientIp();
  const result = await certActions.revokeCertificate(id, reason, staff.id, ip);
  revalidatePath("/admin/certificates");
  revalidatePath("/portal/credentials");
  return result;
}

export async function reissueCertificateAction(id: string, reason: string) {
  const staff = await requireStaffPermission(Permission.ISSUE_CERTIFICATES);
  const ip = await getClientIp();
  const result = await certActions.reissueCertificate(id, reason, staff.id, ip);
  revalidatePath("/admin/certificates");
  revalidatePath("/portal/credentials");
  return result;
}

export async function createTemplateRevisionAction(input: templateActions.CreateTemplateRevisionInput) {
  const staff = await requireStaffPermission(Permission.ISSUE_CERTIFICATES);
  const result = await templateActions.createTemplateRevision(input, staff.id);
  revalidatePath("/admin/certificates");
  return result;
}

export async function activateTemplateAction(id: string) {
  const staff = await requireStaffPermission(Permission.ISSUE_CERTIFICATES);
  const ip = await getClientIp();
  const result = await templateActions.activateTemplate(id, staff.id, ip);
  revalidatePath("/admin/certificates");
  return result;
}
