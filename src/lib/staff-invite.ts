import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { ROLE_PRESETS } from "@/lib/permissions";
import { createInvitationTokenRecord, logStaffInvitationEmail } from "@/lib/staff-invitation";
import type { StaffRole } from "@/generated/prisma/client";

/**
 * Creates the account in INVITED status with the role's preset applied,
 * with no password (Slice 10: INVITED now means "cannot sign in, no
 * password set" — see staff-auth.ts). A real StaffInvitationToken is
 * issued in the same transaction and the invitation link is sent via the
 * same dev-stand-in email path as every other "email" in this app
 * (verification-token.ts's logVerificationEmail).
 */
export async function inviteStaff(params: {
  invitedByStaffId: string;
  name: string;
  email: string;
  role: StaffRole;
  jobTitle?: string;
  department?: string;
}) {
  const { staff, token } = await prisma.$transaction(async (tx) => {
    const staff = await tx.staff.create({
      data: {
        name: params.name,
        email: params.email,
        role: params.role,
        jobTitle: params.jobTitle,
        department: params.department,
        status: "INVITED",
        invitedByStaffId: params.invitedByStaffId,
      },
    });
    await tx.staffPermission.createMany({
      data: ROLE_PRESETS[params.role].map((permission) => ({ staffId: staff.id, permission, grantedByStaffId: params.invitedByStaffId })),
    });
    const token = await createInvitationTokenRecord(tx, staff.id, params.invitedByStaffId);
    await recordAuditEvent(tx, {
      actorStaffId: params.invitedByStaffId,
      subjectType: "staff",
      subjectId: staff.id,
      action: "staff.invited",
      description: `Invited ${params.name} as ${params.role}`,
    });
    return { staff, token };
  });

  logStaffInvitationEmail(staff.email, token);
  return staff;
}
