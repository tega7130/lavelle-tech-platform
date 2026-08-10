import "server-only";
import { getCurrentStaff, type CurrentStaff } from "@/lib/staff-session";
import { Permission } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/lib/rbac";

// Slice 10: reads the DB-backed staff session (staff-session.ts), not
// NextAuth — every one of this file's ~30 call sites across the admin
// console is untouched by that swap, since requireStaffSession /
// requireStaffPermission keep the exact same signatures and shape.
export type StaffSessionUser = CurrentStaff;

export class NotStaffError extends Error {
  constructor() {
    super("Not signed in as staff.");
    this.name = "NotStaffError";
  }
}

export async function requireStaffSession(): Promise<StaffSessionUser> {
  const staff = await getCurrentStaff();
  if (!staff) throw new NotStaffError();
  return staff;
}

/**
 * "Read the permission set from the staff session, not from a role
 * string" — the session already carries the staff member's flattened
 * permission list (read from StaffPermission on every session lookup),
 * so this checks that array directly rather than re-querying the
 * database or special-casing role names. Presence is the authority
 * (Slice 08 rule 1) — super admins hold all 17 rows for real, so there
 * is no separate bypass check here.
 */
export async function requireStaffPermission(permission: Permission): Promise<StaffSessionUser> {
  const user = await requireStaffSession();
  if (!user.permissions.includes(permission)) throw new PermissionDeniedError(permission);
  return user;
}
