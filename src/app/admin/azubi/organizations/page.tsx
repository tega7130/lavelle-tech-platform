import Link from "next/link";
import { listAzubiOrganizations } from "@/lib/azubi-reads";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { buttonClassName } from "@/components/ui/button";
import { AzubiAdminTabs } from "@/components/admin/azubi/azubi-admin-tabs";

export default async function AzubiOrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const organizations = await listAzubiOrganizations(q);

  return (
    <div className="max-w-[1100px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation</div>
      <h1 className="font-heading text-2xl mt-0.5">Organizations</h1>
      <AzubiAdminTabs />

      <div className="flex items-center justify-between flex-wrap gap-[var(--space-3)] mb-[var(--space-4)]">
        <form method="GET" className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search organizations…"
            className="h-[38px] font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none w-[240px] hover:border-neutral-400 focus-visible:border-accent"
          />
          <button type="submit" className={buttonClassName("secondary")}>
            Search
          </button>
        </form>
        <Link href="/admin/azubi/organizations/new" className={buttonClassName("primary")}>
          Add organization
        </Link>
      </div>

      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)]">Name</Th>
              <Th>Org supervisor</Th>
              <Th>Capacity</Th>
              <Th>Fellows assigned</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {organizations.length === 0 && (
              <Tr>
                <Td colSpan={5} className="text-center text-neutral-600 py-[var(--space-5)]">
                  No organizations yet.
                </Td>
              </Tr>
            )}
            {organizations.map((o) => (
              <Tr key={o.id}>
                <Td className="pl-[var(--space-4)]">
                  <Link href={`/admin/azubi/organizations/${o.id}`} className="text-text no-underline hover:underline">
                    {o.name}
                  </Link>
                </Td>
                <Td className="text-[12.5px]">
                  {o.supervisorName ? (
                    <>
                      {o.supervisorName}
                      {o.supervisorEmail && <div className="text-[11.5px] text-neutral-600">{o.supervisorEmail}</div>}
                    </>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </Td>
                <Td className="text-[12.5px]">{o.capacity ?? <span className="text-neutral-500">—</span>}</Td>
                <Td className="text-[12.5px]">{o._count.fellows}</Td>
                <Td className="text-right pr-[var(--space-4)]">
                  <Link href={`/admin/azubi/organizations/${o.id}`} className={buttonClassName("secondary")}>
                    View
                  </Link>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
