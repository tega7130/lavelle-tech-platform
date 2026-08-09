import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { recordAuditEvent } from "@/lib/audit";
import { ROLE_PRESETS } from "@/lib/permissions";
import type { StaffRole } from "@/generated/prisma/client";

/**
 * Creates the account in INVITED status with the role's preset applied.
 * There is no outbound-email infrastructure anywhere in this app (every
 * prior slice's "notification" is an in-app Notification row, never a
 * real email send) — so this stops at creating the account rather than
 * building a real invite-acceptance/password-set flow. Documented as
 * out of scope, not an oversight; see the Slice 08 closing summary.
 */
export async function inviteStaff(params: {
  invitedByStaffId: string;
  name: string;
  email: string;
  role: StaffRole;
  jobTitle?: string;
  department?: string;
}) {
  const temporaryPassword = crypto.randomBytes(24).toString("hex");
  const passwordHash = await hashPassword(temporaryPassword);

  return prisma.$transaction(async (tx) => {
    const staff = await tx.staff.create({
      data: {
        name: params.name,
        email: params.email,
        role: params.role,
        jobTitle: params.jobTitle,
        department: params.department,
        passwordHash,
        status: "INVITED",
        invitedByStaffId: params.invitedByStaffId,
      },
    });
    await tx.staffPermission.createMany({
      data: ROLE_PRESETS[params.role].map((permission) => ({ staffId: staff.id, permission, grantedByStaffId: params.invitedByStaffId })),
    });
    await recordAuditEvent(tx, {
      actorStaffId: params.invitedByStaffId,
      subjectType: "staff",
      subjectId: staff.id,
      action: "staff.invited",
      description: `Invited ${params.name} as ${params.role}`,
    });
    return staff;
  });
}
