import Link from "next/link";
import { listAzubiApplications, listAzubiOrganizationOptions, listAzubiSupervisorOptions } from "@/lib/azubi-reads";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AzubiAdminTabs } from "@/components/admin/azubi/azubi-admin-tabs";
import { AzubiFellowsTable } from "@/components/admin/azubi/azubi-fellows-table";

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

const POOL_FILTERS = [
  { value: undefined, label: "All" },
  { value: "unassigned", label: "Unassigned" },
  { value: "assigned", label: "Assigned" },
  { value: "suspended", label: "Suspended" },
] as const;

const selectClass =
  "h-[38px] font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none hover:border-neutral-400 focus-visible:border-accent";

export default async function AzubiApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    pipelineStatus?: string;
    statusKind?: string;
    workingMode?: string;
    area?: string;
    poolStatus?: string;
    organizationId?: string;
    supervisorId?: string;
    q?: string;
    cursor?: string;
  }>;
}) {
  const { pipelineStatus, statusKind, workingMode, area, poolStatus, organizationId, supervisorId, q, cursor } = await searchParams;
  const [{ items, nextCursor }, organizations, supervisors] = await Promise.all([
    listAzubiApplications({ pipelineStatus, statusKind, workingMode, area, poolStatus, organizationId, supervisorId, q, cursor }),
    listAzubiOrganizationOptions(),
    listAzubiSupervisorOptions(),
  ]);

  const paramsWithout = (omit: "cursor") => {
    const p = new URLSearchParams();
    if (pipelineStatus) p.set("pipelineStatus", pipelineStatus);
    if (statusKind) p.set("statusKind", statusKind);
    if (workingMode) p.set("workingMode", workingMode);
    if (area) p.set("area", area);
    if (poolStatus) p.set("poolStatus", poolStatus);
    if (organizationId) p.set("organizationId", organizationId);
    if (supervisorId) p.set("supervisorId", supervisorId);
    if (q) p.set("q", q);
    if (omit !== "cursor" && cursor) p.set("cursor", cursor);
    return p;
  };

  return (
    <div className="max-w-[1200px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation</div>
      <h1 className="font-heading text-2xl mt-0.5">Fellows</h1>
      <AzubiAdminTabs />

      <div className="flex items-center justify-end mb-[var(--space-4)]">
        {/* A CSV download (Content-Disposition: attachment), not page navigation — plain <a> is correct here. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/exports/azubi-applications" className={buttonClassName("secondary")}>
          Export CSV
        </a>
      </div>

      <div className="flex gap-1 flex-wrap mb-[var(--space-2)]">
        {POOL_FILTERS.map((f) => {
          const p = paramsWithout("cursor");
          if (f.value) p.set("poolStatus", f.value);
          else p.delete("poolStatus");
          const href = `/admin/azubi/applications${p.toString() ? `?${p.toString()}` : ""}`;
          const active = (poolStatus ?? undefined) === f.value;
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

      <div className="flex gap-1 flex-wrap mb-[var(--space-3)]">
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

      <form method="GET" className="flex items-center gap-2 flex-wrap mb-[var(--space-4)]">
        {pipelineStatus && <input type="hidden" name="pipelineStatus" value={pipelineStatus} />}
        {poolStatus && <input type="hidden" name="poolStatus" value={poolStatus} />}
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or email…"
          className={cn(selectClass, "w-[220px]")}
        />
        <select name="organizationId" defaultValue={organizationId ?? ""} className={selectClass}>
          <option value="">All organizations</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select name="supervisorId" defaultValue={supervisorId ?? ""} className={selectClass}>
          <option value="">All supervisors</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClassName("secondary")}>
          Filter
        </button>
      </form>

      <AzubiFellowsTable items={items} organizations={organizations} />

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
