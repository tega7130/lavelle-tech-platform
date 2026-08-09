import Link from "next/link";
import { listStaff } from "@/lib/staff-reads";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import { InviteStaffButton } from "@/components/admin/invite-staff-button";

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  INVITED: "warning",
  SUSPENDED: "danger",
  DEACTIVATED: "neutral",
};

export default async function StaffPage() {
  const staff = await listStaff();

  return (
    <div className="max-w-[1000px]">
      <div className="flex items-center justify-between mb-[var(--space-4)]">
        <h1 className="font-heading text-2xl">Staff & permissions</h1>
        <InviteStaffButton />
      </div>

      {staff.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No staff invited yet</div>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Name</Th>
                <Th>Role</Th>
                <Th>Access</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {staff.map((s) => (
                <Tr key={s.id}>
                  <Td className="pl-[var(--space-4)]">
                    {s.name}
                    <div className="text-[11px] text-neutral-500">{s.email}</div>
                  </Td>
                  <Td>
                    <span
                      className="inline-flex items-center rounded-full text-[11px] font-medium px-[10px] py-[3px] text-white"
                      style={{ backgroundColor: ROLE_COLORS[s.role] }}
                    >
                      {ROLE_LABELS[s.role]}
                    </span>
                  </Td>
                  <Td className="text-[12.5px] text-neutral-600">
                    {s.permissionGrants.length} permission{s.permissionGrants.length === 1 ? "" : "s"}
                  </Td>
                  <Td>
                    <Tag variant={STATUS_TAG[s.status] as TagVariant}>{s.status}</Tag>
                  </Td>
                  <Td className="text-right pr-[var(--space-4)]">
                    <Link href={`/admin/staff/${s.id}`} className="text-accent text-xs">
                      Manage
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
