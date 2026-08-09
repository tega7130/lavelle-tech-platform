import Link from "next/link";
import { listCandidates } from "@/lib/candidate-admin-reads";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { Input } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "APPLICANT", label: "Applicants" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "SUSPENDED", label: "Suspended" },
] as const;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: "APPLICANT" | "ENROLLED" | "SUSPENDED"; cursor?: string }>;
}) {
  const { q, status, cursor } = await searchParams;
  const { items: candidates, nextCursor } = await listCandidates({ q, status, cursor });

  const paramsWithout = (omit: "cursor") => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (omit !== "cursor" && cursor) p.set("cursor", cursor);
    return p;
  };

  return (
    <div className="max-w-[1000px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Candidates</h1>

      <div className="flex items-center justify-between gap-[var(--space-4)] mb-[var(--space-4)]">
        <form action="/admin/candidates">
          {status && <input type="hidden" name="status" value={status} />}
          <Input name="q" defaultValue={q ?? ""} dense placeholder="Search name, email or number…" className="max-w-[320px]" />
        </form>

        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => {
            const p = paramsWithout("cursor");
            if (f.value) p.set("status", f.value);
            else p.delete("status");
            const href = `/admin/candidates${p.toString() ? `?${p.toString()}` : ""}`;
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
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No candidates match those filters</div>
        </div>
      ) : (
        <>
          <div className="border border-divider rounded-md overflow-hidden">
            <Table>
              <Thead>
                <Tr>
                  <Th className="pl-[var(--space-4)]">Name</Th>
                  <Th>Number</Th>
                  <Th>Programme</Th>
                  <Th>Status</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {candidates.map((c) => (
                  <Tr key={c.id}>
                    <Td className="pl-[var(--space-4)]">
                      {c.firstName} {c.lastName}
                      <div className="text-[11px] text-neutral-500">{c.email}</div>
                    </Td>
                    <Td className="tabular-nums text-[13px]">{c.candidateNumber ?? c.applicantNumber}</Td>
                    <Td className="text-[13px]">{c.enrolments[0]?.programme.title ?? "—"}</Td>
                    <Td>
                      {c.accountStatus === "SUSPENDED" ? (
                        <Tag variant="danger">Suspended</Tag>
                      ) : (
                        <Tag variant={c.candidateNumber ? "success" : "neutral"}>{c.candidateNumber ? "Enrolled" : "Applicant"}</Tag>
                      )}
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

          {nextCursor && (
            <div className="mt-[var(--space-4)] text-center">
              <Link
                href={`/admin/candidates?${(() => {
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
        </>
      )}
    </div>
  );
}
