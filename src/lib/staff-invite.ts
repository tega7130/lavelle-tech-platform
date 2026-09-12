import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { ROLE_PRESETS } from "@/lib/permissions";
import { createInvitationTokenRecord, logStaffInvitationEmail } from "@/lib/staff-invitation";
import { sendTransactionalEmailByTemplate } from "@/lib/send-transactional-email";
import { EMAIL_CONFIG } from "@/lib/email-config";
import type { StaffRole } from "@/generated/prisma/client";

/**
 * Creates the account in INVITED status with the role's preset applied,
 * with no password (Slice 10: INVITED now means "cannot sign in, no
 * password set" — see staff-auth.ts). A real StaffInvitationToken is
 * issued in the same transaction and the invitation link is sent via the
 * same dev-stand-in email path as every other "email" in this app
 * (verification-token.ts's logVerificationEmail).
 *
 * The email send is awaited (not fire-and-forget) so the caller — and in
 * turn the admin who clicked "Send invite" — can tell whether the staff
 * member will actually receive anything. A provider failure never rolls
 * back the invitation itself (the account and token are real either way,
 * and "Resend invitation" is the recovery path); it only flips
 * `emailSent` to false so the UI can say so instead of a silent lie.
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
  const emailSent = await sendStaffInvitationEmail(staff, token);

  return { staff, emailSent };
}

/**
 * Shared by inviteStaff and resendStaffInvitationCore so the two never
 * drift into sending different-looking emails for the same underlying
 * link. Awaited by both callers — a provider failure must reach the admin
 * ("Invitation created, but the email could not be sent") rather than
 * vanish into a detached promise's console.error, which is exactly how
 * this went unnoticed before: the account and token were always created
 * correctly, so nothing else in the flow revealed that no email had gone
 * out.
 */
export async function sendStaffInvitationEmail(staff: { name: string; email: string; role: StaffRole }, token: string): Promise<boolean> {
  try {
    const nameParts = staff.name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const roleDescription = EMAIL_CONFIG.roleDescriptions[staff.role as keyof typeof EMAIL_CONFIG.roleDescriptions] || `${staff.role} at Lavelle Institute`;
    const setPasswordUrl = `${process.env.NEXTAUTH_URL}/staff/set-password?token=${token}`;

    const result = await sendTransactionalEmailByTemplate("staff-invitation", staff.email, {
      staffFirstName: firstName,
      staffLastName: lastName,
      role: staff.role,
      roleDescription,
      setPasswordUrl,
      supportEmail: EMAIL_CONFIG.supportEmail,
      currentYear: new Date().getFullYear(),
    });
    return result.success;
  } catch (emailError) {
    console.error("Failed to send staff-invitation email:", emailError);
    return false;
  }
}
