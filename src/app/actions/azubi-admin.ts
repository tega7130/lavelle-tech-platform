"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function revalidateOrganization(id?: string) {
  revalidatePath("/admin/azubi/organizations");
  revalidatePath("/admin/azubi/applications");
  if (id) revalidatePath(`/admin/azubi/organizations/${id}`);
}

function revalidateSupervisor(id?: string) {
  revalidatePath("/admin/azubi/supervisors");
  revalidatePath("/admin/azubi/applications");
  if (id) revalidatePath(`/admin/azubi/supervisors/${id}`);
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

// ─── Organizations (host law firms / legal organisations) ──────────────

export async function createAzubiOrganizationAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Organization name is required");

  const org = await prisma.azubiOrganization.create({
    data: {
      name,
      supervisorName: String(formData.get("supervisorName") || "").trim() || null,
      supervisorEmail: String(formData.get("supervisorEmail") || "").trim() || null,
      supervisorPhone: String(formData.get("supervisorPhone") || "").trim() || null,
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
    },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiOrganization",
    subjectId: org.id,
    action: "azubi_organization.created",
    description: `Added organization "${org.name}"`,
    ipAddress: await getClientIp(),
  });

  revalidateOrganization(org.id);
  redirect(`/admin/azubi/organizations/${org.id}`);
}

export async function updateAzubiOrganizationAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Organization name is required");

  await prisma.azubiOrganization.update({
    where: { id },
    data: {
      name,
      supervisorName: String(formData.get("supervisorName") || "").trim() || null,
      supervisorEmail: String(formData.get("supervisorEmail") || "").trim() || null,
      supervisorPhone: String(formData.get("supervisorPhone") || "").trim() || null,
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
      preferredPracticeAreas: String(formData.get("preferredPracticeAreas") || "").trim() || null,
      preferredFellowLevel: String(formData.get("preferredFellowLevel") || "").trim() || null,
      desiredFellowTraits: String(formData.get("desiredFellowTraits") || "").trim() || null,
    },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiOrganization",
    subjectId: id,
    action: "azubi_organization.updated",
    description: `Updated organization "${name}"`,
    ipAddress: await getClientIp(),
  });

  revalidateOrganization(id);
}

export async function updateAzubiOrganizationNotesAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const internalNotes = String(formData.get("internalNotes") || "");

  await prisma.azubiOrganization.update({ where: { id }, data: { internalNotes: internalNotes || null } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiOrganization",
    subjectId: id,
    action: "azubi_organization.notes_updated",
    description: "Updated internal notes",
    ipAddress: await getClientIp(),
  });

  revalidateOrganization(id);
}

/** Refuses to delete an organization still holding fellows — unassign them first. */
export async function deleteAzubiOrganizationAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));

  const org = await prisma.azubiOrganization.findUnique({ where: { id }, include: { _count: { select: { fellows: true } } } });
  if (!org) throw new Error("Organization not found");
  if (org._count.fellows > 0) throw new Error("Cannot delete an organization with fellows still assigned to it — unassign them first");

  await prisma.azubiOrganization.delete({ where: { id } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiOrganization",
    subjectId: id,
    action: "azubi_organization.deleted",
    description: `Removed organization "${org.name}"`,
    ipAddress: await getClientIp(),
  });

  revalidateOrganization();
  redirect("/admin/azubi/organizations");
}

// ─── Supervisors (Azubi-side, distinct from an org's own contact) ──────

export async function createAzubiSupervisorAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  if (!name || !email) throw new Error("Supervisor name and email are required");

  const supervisor = await prisma.azubiSupervisor.create({
    data: {
      name,
      email,
      phone: String(formData.get("phone") || "").trim() || null,
      staffId: String(formData.get("staffId") || "") || null,
    },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiSupervisor",
    subjectId: supervisor.id,
    action: "azubi_supervisor.created",
    description: `Added supervisor "${supervisor.name}"`,
    ipAddress: await getClientIp(),
  });

  revalidateSupervisor(supervisor.id);
  redirect(`/admin/azubi/supervisors/${supervisor.id}`);
}

export async function updateAzubiSupervisorAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  if (!name || !email) throw new Error("Supervisor name and email are required");

  await prisma.azubiSupervisor.update({
    where: { id },
    data: {
      name,
      email,
      phone: String(formData.get("phone") || "").trim() || null,
      staffId: String(formData.get("staffId") || "") || null,
    },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiSupervisor",
    subjectId: id,
    action: "azubi_supervisor.updated",
    description: `Updated supervisor "${name}"`,
    ipAddress: await getClientIp(),
  });

  revalidateSupervisor(id);
}

/** Refuses to delete a supervisor still assigned to fellows — unassign them first. */
export async function deleteAzubiSupervisorAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));

  const supervisor = await prisma.azubiSupervisor.findUnique({ where: { id }, include: { _count: { select: { fellows: true } } } });
  if (!supervisor) throw new Error("Supervisor not found");
  if (supervisor._count.fellows > 0) throw new Error("Cannot delete a supervisor still assigned to fellows — unassign them first");

  await prisma.azubiSupervisor.delete({ where: { id } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiSupervisor",
    subjectId: id,
    action: "azubi_supervisor.deleted",
    description: `Removed supervisor "${supervisor.name}"`,
    ipAddress: await getClientIp(),
  });

  revalidateSupervisor();
  redirect("/admin/azubi/supervisors");
}

// ─── Fellow assignment (organization / supervisor / suspension) ────────

export async function assignAzubiApplicationOrganizationAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const organizationId = String(formData.get("organizationId") || "") || null;

  const [application, newOrg] = await Promise.all([
    prisma.azubiApplication.findUnique({ where: { id }, include: { assignedOrganization: { select: { name: true } } } }),
    organizationId ? prisma.azubiOrganization.findUnique({ where: { id: organizationId }, select: { name: true } }) : null,
  ]);
  if (!application) throw new Error("Fellow not found");

  await prisma.azubiApplication.update({ where: { id }, data: { assignedOrganizationId: organizationId } });

  const oldLabel = application.assignedOrganization?.name ?? "Unassigned";
  const newLabel = newOrg?.name ?? "Unassigned";
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiApplication",
    subjectId: id,
    action: "azubi_application.organization_assigned",
    description: `Moved from ${oldLabel} → ${newLabel}`,
    ipAddress: await getClientIp(),
  });
  if (organizationId) {
    await recordAuditEvent(prisma, {
      actorStaffId: staff.id,
      subjectType: "AzubiOrganization",
      subjectId: organizationId,
      action: "azubi_organization.fellow_assigned",
      description: `Assigned fellow "${application.fullName}" to this organization`,
      ipAddress: await getClientIp(),
    });
  }

  revalidateApplication(id);
  revalidateOrganization(organizationId ?? undefined);
}

export async function assignAzubiApplicationSupervisorAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const supervisorId = String(formData.get("supervisorId") || "") || null;

  const [application, newSupervisor] = await Promise.all([
    prisma.azubiApplication.findUnique({ where: { id }, include: { assignedSupervisor: { select: { name: true } } } }),
    supervisorId ? prisma.azubiSupervisor.findUnique({ where: { id: supervisorId }, select: { name: true } }) : null,
  ]);
  if (!application) throw new Error("Fellow not found");

  await prisma.azubiApplication.update({ where: { id }, data: { assignedSupervisorId: supervisorId } });

  const oldLabel = application.assignedSupervisor?.name ?? "Unassigned";
  const newLabel = newSupervisor?.name ?? "Unassigned";
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiApplication",
    subjectId: id,
    action: "azubi_application.supervisor_assigned",
    description: `Supervisor moved from ${oldLabel} → ${newLabel}`,
    ipAddress: await getClientIp(),
  });

  revalidateApplication(id);
  if (supervisorId) revalidateSupervisor(supervisorId);
}

export async function setAzubiApplicationSuspendedAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const id = String(formData.get("id"));
  const suspended = formData.get("suspended") === "on" || formData.get("suspended") === "true";

  await prisma.azubiApplication.update({ where: { id }, data: { suspended, suspendedAt: suspended ? new Date() : null } });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "AzubiApplication",
    subjectId: id,
    action: suspended ? "azubi_application.suspended" : "azubi_application.unsuspended",
    description: suspended ? "Suspended" : "Unsuspended",
    ipAddress: await getClientIp(),
  });

  revalidateApplication(id);
}

// ─── Bulk operations (fellows pool) ─────────────────────────────────────

export async function bulkAssignAzubiApplicationsOrganizationAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const organizationId = String(formData.get("organizationId") || "") || null;
  if (ids.length === 0) return;

  const newOrg = organizationId ? await prisma.azubiOrganization.findUnique({ where: { id: organizationId }, select: { name: true } }) : null;
  const newLabel = newOrg?.name ?? "Unassigned";

  await prisma.azubiApplication.updateMany({ where: { id: { in: ids } }, data: { assignedOrganizationId: organizationId } });
  for (const id of ids) {
    await recordAuditEvent(prisma, {
      actorStaffId: staff.id,
      subjectType: "AzubiApplication",
      subjectId: id,
      action: "azubi_application.organization_assigned",
      description: `Bulk-assigned to ${newLabel}`,
      ipAddress: await getClientIp(),
    });
  }

  revalidateApplication(ids[0]!);
  revalidateOrganization(organizationId ?? undefined);
}

export async function bulkSetAzubiApplicationsSuspendedAction(formData: FormData): Promise<void> {
  const staff = await requireStaffPermission(Permission.MANAGE_AZUBI);
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const suspended = formData.get("suspended") === "on" || formData.get("suspended") === "true";
  if (ids.length === 0) return;

  await prisma.azubiApplication.updateMany({ where: { id: { in: ids } }, data: { suspended, suspendedAt: suspended ? new Date() : null } });
  for (const id of ids) {
    await recordAuditEvent(prisma, {
      actorStaffId: staff.id,
      subjectType: "AzubiApplication",
      subjectId: id,
      action: suspended ? "azubi_application.suspended" : "azubi_application.unsuspended",
      description: suspended ? "Bulk-suspended" : "Bulk-unsuspended",
      ipAddress: await getClientIp(),
    });
  }

  revalidateApplication(ids[0]!);
}
