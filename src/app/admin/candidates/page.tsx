import Link from "next/link";
import { listCandidates, type DirectoryStatus } from "@/lib/candidate-admin-reads";
import { Input } from "@/components/ui/field";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CandidatesTable } from "@/components/admin/candidates-table";

const STATUS_FILTERS: { value: DirectoryStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "APPLICANT", label: "Applicant" },
  { value: "ACTIVE", label: "Active" },
  { value: "AT_RISK", label: "At risk" },
  { value: "COMPLETED", label: "Completed" },
  { value: "SUSPENDED", label: "Suspended" },
];

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: DirectoryStatus; cursor?: string }>;
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
    <div className="max-w-[1100px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">People</div>
      <h1 className="font-heading text-2xl mt-0.5 mb-[var(--space-4)]">Candidates</h1>

      <div className="flex items-center justify-between gap-[var(--space-4)] mb-[var(--space-4)] flex-wrap">
        <form action="/admin/candidates">
          {status && <input type="hidden" name="status" value={status} />}
          <Input name="q" defaultValue={q ?? ""} dense placeholder="Search by name or Candidate ID" className="w-[280px]" />
        </form>

        <div className="flex gap-1 flex-wrap">
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
          <CandidatesTable candidates={candidates} />

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
