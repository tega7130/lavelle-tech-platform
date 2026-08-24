import Link from "next/link";
import { getStaffPerformanceStats } from "@/lib/staff-analytics";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";

export default async function StaffPerformancePage() {
  const rows = await getStaffPerformanceStats();
  const active = rows.filter((r) => r.marksReturned > 0 || r.invigilationReviews > 0 || r.supportResolved > 0 || r.blogPostsPublished > 0);

  return (
    <div className="max-w-[1100px]">
      <Link href="/admin/staff" className="text-[12px] text-neutral-500 hover:text-neutral-700 no-underline">
        &larr; Staff & permissions
      </Link>
      <h1 className="font-heading text-2xl mt-1 mb-1">Staff performance</h1>
      <p className="text-neutral-600 text-[13px] mb-[var(--space-4)] max-w-[68ch]">
        Everything this codebase attributes to an individual staff member: marks returned and their average turnaround, sittings
        invigilation-reviewed, support requests resolved, and blog posts published. Staff with no recorded activity are hidden below.
      </p>

      {active.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No recorded staff activity yet</div>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Staff</Th>
                <Th>Marks returned</Th>
                <Th>Avg. turnaround</Th>
                <Th>Invigilation reviews</Th>
                <Th>Support resolved</Th>
                <Th>Blog posts published</Th>
              </Tr>
            </Thead>
            <Tbody>
              {active.map((r) => (
                <Tr key={r.staffId}>
                  <Td className="pl-[var(--space-4)]">
                    <div className="text-[13px]">{r.name}</div>
                    <span
                      className="inline-flex items-center rounded-full text-[10.5px] font-medium px-[9px] py-[2px] text-white mt-1"
                      style={{ backgroundColor: ROLE_COLORS[r.role] }}
                    >
                      {ROLE_LABELS[r.role]}
                    </span>
                  </Td>
                  <Td className="text-[13px] tabular-nums">{r.marksReturned || "—"}</Td>
                  <Td className="text-[13px] tabular-nums">
                    {r.avgMarkingTurnaroundHours != null ? `${r.avgMarkingTurnaroundHours}h` : "—"}
                  </Td>
                  <Td className="text-[13px] tabular-nums">{r.invigilationReviews || "—"}</Td>
                  <Td className="text-[13px] tabular-nums">{r.supportResolved || "—"}</Td>
                  <Td className="text-[13px] tabular-nums">{r.blogPostsPublished || "—"}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
