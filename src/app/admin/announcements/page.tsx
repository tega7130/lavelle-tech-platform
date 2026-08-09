import { listAnnouncements } from "@/lib/announcement-reads";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { AnnouncementComposer } from "@/components/admin/announcement-composer";
import { AnnouncementRowActions } from "@/components/admin/announcement-row-actions";

const STATE_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SCHEDULED: "warning",
  SENT: "success",
  WITHDRAWN: "danger",
};

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements();

  return (
    <div className="max-w-[1000px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Announcements</h1>

      <div className="mb-[var(--space-6)]">
        <AnnouncementComposer />
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No announcements yet</div>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Title</Th>
                <Th>Channels</Th>
                <Th>Recipients</Th>
                <Th>Status</Th>
                <Th className="text-right pr-[var(--space-4)]">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {announcements.map((a) => (
                <Tr key={a.id}>
                  <Td className="pl-[var(--space-4)] font-medium">
                    {a.title}
                    <div className="text-[11px] text-neutral-500">{a.createdByStaff.name}</div>
                  </Td>
                  <Td className="text-[12px] text-neutral-600">{a.channels.join(", ")}</Td>
                  <Td className="tabular-nums">{a.recipientCount ?? "—"}</Td>
                  <Td>
                    <Tag variant={STATE_TAG[a.state] as TagVariant}>{a.state}</Tag>
                  </Td>
                  <Td className="text-right pr-[var(--space-4)]">
                    <AnnouncementRowActions id={a.id} state={a.state} />
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
