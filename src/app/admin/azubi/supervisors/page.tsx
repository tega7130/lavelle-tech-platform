import Link from "next/link";
import { listAzubiSupervisors } from "@/lib/azubi-reads";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { buttonClassName } from "@/components/ui/button";
import { AzubiAdminTabs } from "@/components/admin/azubi/azubi-admin-tabs";

export default async function AzubiSupervisorsPage() {
  const supervisors = await listAzubiSupervisors();

  return (
    <div className="max-w-[1000px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation</div>
      <h1 className="font-heading text-2xl mt-0.5">Supervisors</h1>
      <AzubiAdminTabs />

      <div className="flex items-center justify-end mb-[var(--space-4)]">
        <Link href="/admin/azubi/supervisors/new" className={buttonClassName("primary")}>
          Add supervisor
        </Link>
      </div>

      <div className="border border-divider rounded-md overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th className="pl-[var(--space-4)]">Name</Th>
              <Th>Email</Th>
              <Th>Lavelle staff</Th>
              <Th>Fellows supervised</Th>
            </Tr>
          </Thead>
          <Tbody>
            {supervisors.length === 0 && (
              <Tr>
                <Td colSpan={4} className="text-center text-neutral-600 py-[var(--space-5)]">
                  No supervisors yet.
                </Td>
              </Tr>
            )}
            {supervisors.map((s) => (
              <Tr key={s.id}>
                <Td className="pl-[var(--space-4)]">
                  <Link href={`/admin/azubi/supervisors/${s.id}`} className="text-text no-underline hover:underline">
                    {s.name}
                  </Link>
                </Td>
                <Td className="text-[12.5px]">{s.email}</Td>
                <Td className="text-[12.5px]">{s.staff?.name ?? <span className="text-neutral-500">External</span>}</Td>
                <Td className="text-[12.5px]">{s._count.fellows}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
