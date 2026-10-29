"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/lib/audit";
import { getClientIp } from "@/lib/request-info";

// Plain `(formData) => Promise<void>` server actions, bound directly to
// <form action={...}>, not useActionState — these are simple, trusted
// internal admin mutations (status/assignment/notes), and revalidatePath
// is enough to refresh the page; no client-side pending/error UI needed.

function revalidateApplication(id: string) {
  revalidatePath("/admin/azubi");
  revalidatePath("/admin/azubi/applications");
  revalidatePath(`/admin/azubi/applications/${id}`);
}

function revalidateEnquiry(id: string) {
  revalidatePath("/admin/azubi");
  revalidatePath("/admin/azubi/enquiries");
  revalidatePath(`/admin/azubi/enquiries/${id}`);
}

export async function updateAzubiApplicationStatusAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const pipelineStatus = String(formData.get("pipelineStatus"));

  await prisma.azubiApplication.update({ where: { id }, data: { pipelineStatus: pipelineStatus as never } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiApplication",
    subjectId: id,
    action: "azubi_application.status_changed",
    description: `Changed application pipeline status to ${pipelineStatus}`,
    ipAddress: await getClientIp(),
  });

  revalidateApplication(id);
}

export async function assignAzubiApplicationAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const assignedToStaffId = String(formData.get("assignedToStaffId") || "") || null;

  await prisma.azubiApplication.update({ where: { id }, data: { assignedToStaffId } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiApplication",
    subjectId: id,
    action: "azubi_application.assigned",
    description: assignedToStaffId ? `Assigned application to staff ${assignedToStaffId}` : "Unassigned application",
    ipAddress: await getClientIp(),
  });

  revalidateApplication(id);
}

export async function updateAzubiApplicationNotesAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const internalNotes = String(formData.get("internalNotes") || "");

  await prisma.azubiApplication.update({ where: { id }, data: { internalNotes: internalNotes || null } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiApplication",
    subjectId: id,
    action: "azubi_application.notes_updated",
    description: "Updated internal notes",
    ipAddress: await getClientIp(),
  });

  revalidateApplication(id);
}

export async function setAzubiApplicationStatusConfirmedAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const confirmed = formData.get("confirmed") === "on" || formData.get("confirmed") === "true";

  await prisma.azubiApplication.update({ where: { id }, data: { statusConfirmedAt: confirmed ? new Date() : null } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiApplication",
    subjectId: id,
    action: confirmed ? "azubi_application.status_confirmed" : "azubi_application.status_confirmation_cleared",
    description: confirmed
      ? "Marked status confirmed (student/law school ID or call certificate checked outside this form)"
      : "Cleared status confirmation",
    ipAddress: await getClientIp(),
  });

  revalidateApplication(id);
}

/** Data-subject deletion/anonymisation request (build brief section 7) — never deletes the audit trail itself. */
export async function anonymizeAzubiApplicationAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));

  await prisma.azubiApplication.update({
    where: { id },
    data: {
      fullName: "Redacted",
      email: `redacted-${id}@example.invalid`,
      phone: "redacted",
      state: "redacted",
      institution: "redacted",
      statement: "redacted",
      internalNotes: null,
    },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiApplication",
    subjectId: id,
    action: "azubi_application.anonymized",
    description: "Anonymised application for a data-subject request",
    ipAddress: await getClientIp(),
  });

  revalidateApplication(id);
}

export async function updateAzubiEnquiryStatusAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));

  await prisma.azubiEnquiry.update({ where: { id }, data: { status: status as never } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiEnquiry",
    subjectId: id,
    action: "azubi_enquiry.status_changed",
    description: `Changed enquiry status to ${status}`,
    ipAddress: await getClientIp(),
  });

  revalidateEnquiry(id);
}

export async function assignAzubiEnquiryAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const assignedToStaffId = String(formData.get("assignedToStaffId") || "") || null;

  await prisma.azubiEnquiry.update({ where: { id }, data: { assignedToStaffId } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiEnquiry",
    subjectId: id,
    action: "azubi_enquiry.assigned",
    description: assignedToStaffId ? `Assigned enquiry to staff ${assignedToStaffId}` : "Unassigned enquiry",
    ipAddress: await getClientIp(),
  });

  revalidateEnquiry(id);
}

export async function updateAzubiEnquiryNotesAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const internalNotes = String(formData.get("internalNotes") || "");

  await prisma.azubiEnquiry.update({ where: { id }, data: { internalNotes: internalNotes || null } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiEnquiry",
    subjectId: id,
    action: "azubi_enquiry.notes_updated",
    description: "Updated internal notes",
    ipAddress: await getClientIp(),
  });

  revalidateEnquiry(id);
}

export async function anonymizeAzubiEnquiryAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));

  await prisma.azubiEnquiry.update({
    where: { id },
    data: { fullName: "Redacted", email: `redacted-${id}@example.invalid`, organisation: null, message: "redacted", internalNotes: null },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiEnquiry",
    subjectId: id,
    action: "azubi_enquiry.anonymized",
    description: "Anonymised enquiry for a data-subject request",
    ipAddress: await getClientIp(),
  });

  revalidateEnquiry(id);
}
