import "server-only";
import { prisma } from "@/lib/prisma";
import { Permission, StaffRole, StaffStatus } from "@/generated/prisma/client";
import { ROLE_PRESETS, hasPermission } from "@/lib/permissions";

export class PermissionDeniedError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export class LastSuperAdminError extends Error {
  constructor() {
    super("At least one active super admin must always exist.");
    this.name = "LastSuperAdminError";
  }
}

async function staffWithGrants(staffId: string) {
  return prisma.staff.findUniqueOrThrow({
    where: { id: staffId },
    include: { permissionGrants: true },
  });
}

/** Throws PermissionDeniedError unless the staff member holds `permission` (or SUPER_ADMIN). */
export async function guardPermission(staffId: string, permission: Permission) {
  const staff = await staffWithGrants(staffId);
  const grants = staff.permissionGrants.map((g) => ({ permission: g.permission, granted: g.granted }));
  if (!hasPermission({ role: staff.role, grants }, permission)) {
    throw new PermissionDeniedError(permission);
  }
  return staff;
}

/** Business rule 13: deactivating/removing the last active super admin is blocked outright. */
export async function assertNotLastActiveSuperAdmin(excludingStaffId: string) {
  const count = await prisma.staff.count({
    where: {
      status: StaffStatus.ACTIVE,
      id: { not: excludingStaffId },
      permissionGrants: { some: { permission: Permission.SUPER_ADMIN, granted: true } },
    },
  });
  if (count === 0) throw new LastSuperAdminError();
}

/**
 * Replaces a staff member's permission set with the target role's preset
 * and writes the audit entry (README: "Applying a preset replaces the
 * current set and confirms first" / rule 10 on every permission change).
 * Business rule 12: only a super admin may grant super_admin.
 */
export async function applyRolePreset(params: {
  staffId: string;
  role: StaffRole;
  actingStaffId: string;
}) {
  const { staffId, role, actingStaffId } = params;

  if (role === StaffRole.SUPER_ADMIN) {
    const acting = await staffWithGrants(actingStaffId);
    const actingIsSuperAdmin = acting.permissionGrants.some(
      (g) => g.permission === Permission.SUPER_ADMIN && g.granted
    );
    if (!actingIsSuperAdmin) {
      throw new PermissionDeniedError(Permission.SUPER_ADMIN);
    }
  }

  const preset = ROLE_PRESETS[role];

  await prisma.$transaction(async (tx) => {
    await tx.staff.update({ where: { id: staffId }, data: { role } });
    await tx.permissionGrant.deleteMany({ where: { staffId } });
    await tx.permissionGrant.createMany({
      data: preset.map((permission) => ({ staffId, permission, granted: true })),
    });
    await tx.auditLogEntry.create({
      data: {
        actorStaffId: actingStaffId,
        action: "staff.role.apply_preset",
        targetType: "Staff",
        targetId: staffId,
        metadata: { role },
      },
    });
  });
}

/** A single permission toggle — saves immediately and audit-logs (README). */
export async function setPermission(params: {
  staffId: string;
  permission: Permission;
  granted: boolean;
  actingStaffId: string;
}) {
  const { staffId, permission, granted, actingStaffId } = params;

  if (permission === Permission.SUPER_ADMIN && granted) {
    const acting = await staffWithGrants(actingStaffId);
    const actingIsSuperAdmin = acting.permissionGrants.some(
      (g) => g.permission === Permission.SUPER_ADMIN && g.granted
    );
    if (!actingIsSuperAdmin) throw new PermissionDeniedError(Permission.SUPER_ADMIN);
  }
  if (permission === Permission.SUPER_ADMIN && !granted) {
    await assertNotLastActiveSuperAdmin(staffId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.permissionGrant.upsert({
      where: { staffId_permission: { staffId, permission } },
      create: { staffId, permission, granted },
      update: { granted },
    });
    await tx.auditLogEntry.create({
      data: {
        actorStaffId: actingStaffId,
        action: granted ? "staff.permission.grant" : "staff.permission.revoke",
        targetType: "Staff",
        targetId: staffId,
        metadata: { permission },
      },
    });
  });
}

/** Business rule 14: deactivating a staff account requires a reason and revokes the session immediately. */
export async function deactivateStaff(params: { staffId: string; reason: string; actingStaffId: string }) {
  const { staffId, reason, actingStaffId } = params;
  await assertNotLastActiveSuperAdmin(staffId);

  await prisma.$transaction(async (tx) => {
    await tx.staff.update({ where: { id: staffId }, data: { status: StaffStatus.INACTIVE } });
    await tx.auditLogEntry.create({
      data: {
        actorStaffId: actingStaffId,
        action: "staff.deactivate",
        targetType: "Staff",
        targetId: staffId,
        reason,
      },
    });
  });
}
