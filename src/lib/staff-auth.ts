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
 * StaffPermission), so this checks that array directly rather than
 * re-querying the database or special-casing role names. Presence is the
 * authority (Slice 08 rule 1) — super admins hold all 17 rows for real,
 * so there is no separate bypass check here.
 */
export async function requireStaffPermission(permission: Permission): Promise<StaffSessionUser> {
  const user = await requireStaffSession();
  if (!user.permissions.includes(permission)) throw new PermissionDeniedError(permission);
  return user;
}
