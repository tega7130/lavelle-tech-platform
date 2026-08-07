import Link from "next/link";
import { listCandidatesForAdmin } from "@/lib/candidate-admin-reads";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { Input } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const candidates = await listCandidatesForAdmin(q);

  return (
    <div className="max-w-[1000px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Candidates</h1>

      <form className="mb-[var(--space-4)]" action="/admin/candidates">
        <Input name="q" defaultValue={q ?? ""} dense placeholder="Search name, email or number…" className="max-w-[320px]" />
      </form>

      {candidates.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No candidates match those filters</div>
        </div>
      ) : (
        <div className="border border-divider rounded-md overflow-hidden">
          <Table>
            <Thead>
              <Tr>
                <Th className="pl-[var(--space-4)]">Name</Th>
                <Th>Number</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {candidates.map((c) => (
                <Tr key={c.id}>
                  <Td className="pl-[var(--space-4)]">
                    {c.firstName} {c.lastName}
                  </Td>
                  <Td className="tabular-nums text-[13px]">{c.candidateNumber ?? c.applicantNumber}</Td>
                  <Td className="text-[13px]">{c.email}</Td>
                  <Td>
                    <Tag variant={c.candidateNumber ? "success" : "neutral"}>
                      {c.candidateNumber ? "Enrolled" : "Applicant"}
                    </Tag>
                  </Td>
                  <Td className="text-right pr-[var(--space-4)]">
                    <Link href={`/admin/candidates/${c.id}`} className={buttonClassName("secondary", "h-[30px] px-[11px] text-[12px]")}>
                      View
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
