import { notFound } from "next/navigation";
import { getStaffMember } from "@/lib/staff-reads";
import { requireStaffSession } from "@/lib/staff-auth";
import { StaffPermissionEditor } from "@/components/admin/staff-permission-editor";

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [staff, user] = await Promise.all([getStaffMember(id), requireStaffSession()]);
  if (!staff) notFound();

  return (
    <StaffPermissionEditor
      staff={{
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        status: staff.status,
        permissions: staff.permissionGrants.map((g) => g.permission),
      }}
      isSelf={staff.id === user.id}
    />
  );
}
