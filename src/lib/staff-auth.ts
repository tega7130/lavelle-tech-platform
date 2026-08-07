import "server-only";
import { auth } from "@/lib/auth";
import { Permission } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/lib/rbac";

export interface StaffSessionUser {
  userType: "staff";
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: Permission[];
}

export class NotStaffError extends Error {
  constructor() {
    super("Not signed in as staff.");
    this.name = "NotStaffError";
  }
}

export async function requireStaffSession(): Promise<StaffSessionUser> {
  const session = await auth();
  if (!session || session.user.userType !== "staff") throw new NotStaffError();
  return session.user as StaffSessionUser;
}

/**
 * Slice 02's own instruction: "Read the permission set from the staff
 * session, not from a role string" — the JWT already carries the staff
 * member's flattened permission list (set at sign-in from
 * PermissionGrant), so this checks that array directly rather than
 * re-querying the database or special-casing role names.
 */
export async function requireStaffPermission(permission: Permission): Promise<StaffSessionUser> {
  const user = await requireStaffSession();
  const has = user.permissions.includes(Permission.SUPER_ADMIN) || user.permissions.includes(permission);
  if (!has) throw new PermissionDeniedError(permission);
  return user;
}
