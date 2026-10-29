import Link from "next/link";
import { listAzubiEnquiries } from "@/lib/azubi-reads";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "NEW", label: "New" },
  { value: "REPLIED", label: "Replied" },
  { value: "CLOSED", label: "Closed" },
] as const;

const WRITING_AS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "FELLOW", label: "Fellow" },
  { value: "HOST", label: "Host" },
  { value: "OTHER_ORG", label: "Other organisation" },
  { value: "OTHER", label: "Other" },
] as const;

export default async function AzubiEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ writingAs?: string; status?: string; cursor?: string }>;
}) {
  const { writingAs, status, cursor } = await searchParams;
  const { items, nextCursor } = await listAzubiEnquiries({ writingAs, status, cursor });

  const paramsWithout = (omit: "cursor") => {
    const p = new URLSearchParams();
    if (writingAs) p.set("writingAs", writingAs);
    if (status) p.set("status", status);
    if (omit !== "cursor" && cursor) p.set("cursor", cursor);
    return p;
  };

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-center justify-between flex-wrap gap-[var(--space-3)] mb-[var(--space-4)]">
        <div>
          <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation</div>
          <h1 className="font-heading text-2xl mt-0.5">Enquiries</h1>
        </div>
        {/* A CSV download (Content-Disposition: attachment), not page navigation — plain <a> is correct here. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/exports/azubi-enquiries" className={buttonClassName("secondary")}>
          Export CSV
        </a>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-[var(--space-3)] mb-[var(--space-4)]">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const p = paramsWithout("cursor");
            if (f.value) p.set("status", f.value);
            else p.delete("status");
            const href = `/admin/azubi/enquiries${p.toString() ? `?${p.toString()}` : ""}`;
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
        <div className="flex gap-1 flex-wrap">
          {WRITING_AS_FILTERS.map((f) => {
            const p = paramsWithout("cursor");
            if (f.value) p.set("writingAs", f.value);
            else p.delete("writingAs");
            const href = `/admin/azubi/enquiries${p.toString() ? `?${p.toString()}` : ""}`;
            const active = (writingAs ?? undefined) === f.value;
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
      </div>

      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)]">Name</Th>
              <Th>Writing as</Th>
              <Th>Source</Th>
              <Th>Status</Th>
              <Th>Assigned to</Th>
              <Th>Submitted</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 && (
              <Tr>
                <Td colSpan={6} className="text-center text-neutral-600 py-[var(--space-5)]">
                  No enquiries match these filters.
                </Td>
              </Tr>
            )}
            {items.map((e) => (
              <Tr key={e.id}>
                <Td className="pl-[var(--space-4)]">
                  <Link href={`/admin/azubi/enquiries/${e.id}`} className="text-text no-underline hover:underline">
                    {e.fullName}
                  </Link>
                  <div className="text-[11.5px] text-neutral-600">
                    {e.email} · {e.phone}
                  </div>
                </Td>
                <Td className="text-[12.5px]">{e.writingAs.replace("_", " ")}</Td>
                <Td className="text-[12.5px]">{e.source === "HOME_FORM" ? "Home page" : "Contact page"}</Td>
                <Td className="text-[12.5px]">{e.status}</Td>
                <Td className="text-[12.5px]">{e.assignedToStaff?.name ?? "—"}</Td>
                <Td className="text-[12.5px] text-neutral-600">{e.createdAt.toLocaleDateString()}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      {nextCursor && (
        <div className="mt-[var(--space-4)]">
          <Link
            href={`/admin/azubi/enquiries?${(() => {
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
