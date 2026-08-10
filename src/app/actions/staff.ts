"use server";

import { revalidatePath } from "next/cache";
import { Permission, StaffRole } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { applyRolePreset, setPermission, deactivateStaff, suspendStaff, liftSuspension } from "@/lib/rbac";
import { inviteStaff } from "@/lib/staff-invite";

export async function inviteStaffAction(params: { name: string; email: string; role: StaffRole; jobTitle?: string; department?: string }) {
  const staff = await requireStaffPermission(Permission.MANAGE_STAFF);
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  if (!name || !email) throw new Error("Name and email are required.");
  const created = await inviteStaff({ invitedByStaffId: staff.id, name, email, role: params.role, jobTitle: params.jobTitle, department: params.department });
  revalidatePath("/admin/staff");
  return created;
}

export async function applyRolePresetAction(targetStaffId: string, role: StaffRole) {
  const staff = await requireStaffPermission(Permission.MANAGE_STAFF);
  await applyRolePreset({ staffId: targetStaffId, role, actingStaffId: staff.id });
  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${targetStaffId}`);
}

export async function setPermissionAction(targetStaffId: string, permission: Permission, granted: boolean) {
  const staff = await requireStaffPermission(Permission.MANAGE_STAFF);
  await setPermission({ staffId: targetStaffId, permission, granted, actingStaffId: staff.id });
  revalidatePath(`/admin/staff/${targetStaffId}`);
}

export async function deactivateStaffAction(targetStaffId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_STAFF);
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  await deactivateStaff({ staffId: targetStaffId, reason: trimmed, actingStaffId: staff.id });
  revalidatePath("/admin/staff");
}

export async function suspendStaffAction(targetStaffId: string, reason: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_STAFF);
  await suspendStaff({ staffId: targetStaffId, reason, actingStaffId: staff.id });
  revalidatePath("/admin/staff");
}

export async function liftSuspensionAction(targetStaffId: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_STAFF);
  await liftSuspension({ staffId: targetStaffId, actingStaffId: staff.id });
  revalidatePath("/admin/staff");
}
