import "server-only";
import { prisma } from "@/lib/prisma";
import { Permission, StaffRole, StaffStatus } from "@/generated/prisma/client";
import { ROLE_PRESETS, hasPermission } from "@/lib/permissions";
import { revokeAllStaffSessions } from "@/lib/staff-session";

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

// Rule: staff cannot edit their own permission set — a role change or
// permission toggle always needs another admin's hand on it, so no one
// can silently escalate (or accidentally lock themselves out of) their
// own access.
export class SelfPermissionEditError extends Error {
  constructor() {
    super("You cannot change your own role or permissions.");
    this.name = "SelfPermissionEditError";
  }
}

async function staffWithGrants(staffId: string) {
  return prisma.staff.findUniqueOrThrow({
    where: { id: staffId },
    include: { permissionGrants: true },
  });
}

/** Throws PermissionDeniedError unless the staff member holds `permission`. */
export async function guardPermission(staffId: string, permission: Permission) {
  const staff = await staffWithGrants(staffId);
  const grants = staff.permissionGrants.map((g) => ({ permission: g.permission }));
  if (!hasPermission({ grants }, permission)) {
    throw new PermissionDeniedError(permission);
  }
  return staff;
}

/**
 * Deactivating/suspending/demoting the last active super admin is
 * blocked outright. Read-only callers (e.g. a pre-flight UI check) may
 * call this outside a transaction, but any caller that goes on to WRITE
 * based on the result (deactivateStaff, applyRolePreset's demote path)
 * MUST call assertNotLastActiveSuperAdminTx with the same `tx` instead —
 * see that function's comment for why a bare COUNT is not safe there.
 */
export async function assertNotLastActiveSuperAdmin(excludingStaffId: string) {
  const count = await prisma.staff.count({
    where: {
      status: StaffStatus.ACTIVE,
      role: StaffRole.SUPER_ADMIN,
      id: { not: excludingStaffId },
    },
  });
  if (count === 0) throw new LastSuperAdminError();
}

/**
 * The transaction-safe version. Two concurrent requests each demoting a
 * DIFFERENT super admin (with exactly two active super admins total)
 * would both see "one other exists" under a plain COUNT taken outside,
 * or even inside, an ordinarily-isolated transaction, and both would
 * proceed, leaving zero. Callers run their whole transaction at
 * Postgres's SERIALIZABLE isolation level (see applyRolePreset /
 * deactivateStaff) specifically so this count participates in
 * serializable-conflict detection: if two concurrent transactions both
 * read the super-admin count and then both write based on it, Postgres
 * aborts one at commit with a serialization failure, which surfaces
 * here as a thrown error — exactly like FOR UPDATE row locking would,
 * but through the ordinary query builder rather than raw SQL.
 */
async function assertNotLastActiveSuperAdminTx(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], excludingStaffId: string) {
  const count = await tx.staff.count({
    where: { status: StaffStatus.ACTIVE, role: StaffRole.SUPER_ADMIN, id: { not: excludingStaffId } },
  });
  if (count === 0) throw new LastSuperAdminError();
}

/**
 * Replaces a staff member's permission set with the target role's preset
 * and writes the audit entry (README: "Applying a preset replaces the
 * current set and confirms first" / rule 10 on every permission change).
 * Only a super admin may promote someone to super admin; demoting the
 * last active super admin away from the role is blocked; staff cannot
 * apply a preset to themselves.
 */
export async function applyRolePreset(params: {
  staffId: string;
  role: StaffRole;
  actingStaffId: string;
}) {
  const { staffId, role, actingStaffId } = params;

  if (staffId === actingStaffId) throw new SelfPermissionEditError();

  if (role === StaffRole.SUPER_ADMIN) {
    const acting = await prisma.staff.findUniqueOrThrow({ where: { id: actingStaffId } });
    if (acting.role !== StaffRole.SUPER_ADMIN) {
      throw new PermissionDeniedError(Permission.MANAGE_STAFF);
    }
  }

  const preset = ROLE_PRESETS[role];

  await prisma.$transaction(
    async (tx) => {
      if (role !== StaffRole.SUPER_ADMIN) {
        const target = await tx.staff.findUniqueOrThrow({ where: { id: staffId } });
        if (target.role === StaffRole.SUPER_ADMIN) {
          await assertNotLastActiveSuperAdminTx(tx, staffId);
        }
      }
      await tx.staff.update({ where: { id: staffId }, data: { role } });
      await tx.staffPermission.deleteMany({ where: { staffId } });
      await tx.staffPermission.createMany({
        data: preset.map((permission) => ({ staffId, permission, grantedByStaffId: actingStaffId })),
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: actingStaffId,
          action: "staff.role.apply_preset",
          subjectType: "staff",
          subjectId: staffId,
          description: `Applied the ${role} permission preset`,
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
}

/**
 * A single permission toggle — saves immediately and audit-logs
 * (README). Presence is the authority (rule 1): granting inserts a row,
 * revoking deletes it.
 */
export async function setPermission(params: {
  staffId: string;
  permission: Permission;
  granted: boolean;
  actingStaffId: string;
}) {
  const { staffId, permission, granted, actingStaffId } = params;

  if (staffId === actingStaffId) throw new SelfPermissionEditError();

  await prisma.$transaction(async (tx) => {
    if (granted) {
      await tx.staffPermission.upsert({
        where: { staffId_permission: { staffId, permission } },
        create: { staffId, permission, grantedByStaffId: actingStaffId },
        update: {},
      });
    } else {
      await tx.staffPermission.deleteMany({ where: { staffId, permission } });
    }
    await tx.auditEvent.create({
      data: {
        actorStaffId: actingStaffId,
        action: granted ? "staff.permission.grant" : "staff.permission.revoke",
        subjectType: "staff",
        subjectId: staffId,
        description: `${granted ? "Granted" : "Revoked"} the ${permission} permission`,
      },
    });
  });
}

/** Deactivating a staff account requires a reason and revokes the session immediately. */
export async function deactivateStaff(params: { staffId: string; reason: string; actingStaffId: string }) {
  const { staffId, reason, actingStaffId } = params;

  await prisma.$transaction(
    async (tx) => {
      const target = await tx.staff.findUniqueOrThrow({ where: { id: staffId } });
      if (target.role === StaffRole.SUPER_ADMIN) {
        await assertNotLastActiveSuperAdminTx(tx, staffId);
      }
      await tx.staff.update({ where: { id: staffId }, data: { status: StaffStatus.DEACTIVATED } });
      // Slice 10 rule 6: deactivating must revoke live sessions immediately,
      // not just block future sign-ins — the next request from an already
      // signed-in browser must be treated as signed out.
      await revokeAllStaffSessions(staffId, tx);
      await tx.auditEvent.create({
        data: {
          actorStaffId: actingStaffId,
          action: "staff.deactivate",
          subjectType: "staff",
          subjectId: staffId,
          description: "Deactivated the staff account",
          reason,
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
}
