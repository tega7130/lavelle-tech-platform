import Link from "next/link";
import { listAzubiApplications } from "@/lib/azubi-reads";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const PIPELINE_FILTERS = [
  { value: undefined, label: "All" },
  { value: "NEW", label: "New" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "STATUS_CONFIRMED", label: "Status confirmed" },
  { value: "MATCHED", label: "Matched" },
  { value: "PLACED", label: "Placed" },
  { value: "DECLINED", label: "Declined" },
  { value: "WITHDRAWN", label: "Withdrawn" },
] as const;

export default async function AzubiApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineStatus?: string; statusKind?: string; workingMode?: string; area?: string; cursor?: string }>;
}) {
  const { pipelineStatus, statusKind, workingMode, area, cursor } = await searchParams;
  const { items, nextCursor } = await listAzubiApplications({ pipelineStatus, statusKind, workingMode, area, cursor });

  const paramsWithout = (omit: "cursor") => {
    const p = new URLSearchParams();
    if (pipelineStatus) p.set("pipelineStatus", pipelineStatus);
    if (statusKind) p.set("statusKind", statusKind);
    if (workingMode) p.set("workingMode", workingMode);
    if (area) p.set("area", area);
    if (omit !== "cursor" && cursor) p.set("cursor", cursor);
    return p;
  };

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-center justify-between flex-wrap gap-[var(--space-3)] mb-[var(--space-4)]">
        <div>
          <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation</div>
          <h1 className="font-heading text-2xl mt-0.5">Applications</h1>
        </div>
        {/* A CSV download (Content-Disposition: attachment), not page navigation — plain <a> is correct here. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/exports/azubi-applications" className={buttonClassName("secondary")}>
          Export CSV
        </a>
      </div>

      <div className="flex gap-1 flex-wrap mb-[var(--space-4)]">
        {PIPELINE_FILTERS.map((f) => {
          const p = paramsWithout("cursor");
          if (f.value) p.set("pipelineStatus", f.value);
          else p.delete("pipelineStatus");
          const href = `/admin/azubi/applications${p.toString() ? `?${p.toString()}` : ""}`;
          const active = (pipelineStatus ?? undefined) === f.value;
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

      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)]">Name</Th>
              <Th>Status</Th>
              <Th>Working mode</Th>
              <Th>Pipeline</Th>
              <Th>Assigned to</Th>
              <Th>Submitted</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 && (
              <Tr>
                <Td colSpan={6} className="text-center text-neutral-600 py-[var(--space-5)]">
                  No applications match these filters.
                </Td>
              </Tr>
            )}
            {items.map((a) => (
              <Tr key={a.id}>
                <Td className="pl-[var(--space-4)]">
                  <Link href={`/admin/azubi/applications/${a.id}`} className="text-text no-underline hover:underline">
                    {a.fullName}
                  </Link>
                  <div className="text-[11.5px] text-neutral-600">{a.email}</div>
                </Td>
                <Td className="text-[12.5px]">{a.statusKind.replace("_", " ")}</Td>
                <Td className="text-[12.5px]">{a.workingMode}</Td>
                <Td className="text-[12.5px]">{a.pipelineStatus.replace("_", " ")}</Td>
                <Td className="text-[12.5px]">{a.assignedToStaff?.name ?? "—"}</Td>
                <Td className="text-[12.5px] text-neutral-600">{a.createdAt.toLocaleDateString()}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      {nextCursor && (
        <div className="mt-[var(--space-4)]">
          <Link
            href={`/admin/azubi/applications?${(() => {
              const p = paramsWithout("cursor");
              p.set("cursor", nextCursor);
              return p.toString();
            })()}`}
            className={buttonClassName("secondary")}
          >
            Load more
          </Link>
        </div>
      )}
    </div>
  );
}
