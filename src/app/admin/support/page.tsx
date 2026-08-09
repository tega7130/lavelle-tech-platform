import Link from "next/link";
import { listSupportRequests } from "@/lib/support-reads";
import { Tag, type TagVariant } from "@/components/ui/tag";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { RequestStatus } from "@/generated/prisma/client";

const STATUS_TAG: Record<string, TagVariant | "success" | "warning" | "danger"> = {
  OPEN: "warning",
  IN_PROGRESS: "accent",
  RESOLVED: "success",
};

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: RequestStatus }> }) {
  const { status } = await searchParams;
  const requests = await listSupportRequests({ status });

  return (
    <div className="max-w-[1000px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Support desk</h1>

      <div className="flex gap-1 mb-[var(--space-4)]">
        {STATUS_FILTERS.map((f) => {
          const href = f.value ? `/admin/support?status=${f.value}` : "/admin/support";
          const active = (status ?? undefined) === f.value;
          return (
            <Link
              key={f.label}
              href={href}
              className={cn(
                "inline-flex items-center rounded-md px-3 py-1.5 text-[12.5px] font-medium no-underline",
                active ? "bg-accent-100 text-accent-700" : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No support requests</div>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Candidate</Th>
                <Th>Subject</Th>
                <Th>Category</Th>
                <Th>Assigned to</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {requests.map((r) => (
                <Tr key={r.id}>
                  <Td className="pl-[var(--space-4)]">
                    {r.candidate.firstName} {r.candidate.lastName}
                  </Td>
                  <Td className="font-medium">{r.subject}</Td>
                  <Td className="text-[12.5px] text-neutral-600">{r.category}</Td>
                  <Td className="text-[12.5px] text-neutral-600">{r.assignedStaff?.name ?? "Unassigned"}</Td>
                  <Td>
                    <Tag variant={STATUS_TAG[r.status] as TagVariant}>{r.status.replace(/_/g, " ")}</Tag>
                  </Td>
                  <Td className="text-right pr-[var(--space-4)]">
                    <Link href={`/admin/support/${r.id}`} className="text-accent text-xs">
                      Open
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
