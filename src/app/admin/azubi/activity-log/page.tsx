import Link from "next/link";
import { listAzubiActivityLog, listAzubiAssignableStaff } from "@/lib/azubi-reads";
import { buttonClassName } from "@/components/ui/button";
import { AzubiAdminTabs } from "@/components/admin/azubi/azubi-admin-tabs";

const SUBJECT_TYPES = [
  { value: undefined, label: "All" },
  { value: "AzubiApplication", label: "Fellows" },
  { value: "AzubiOrganization", label: "Organizations" },
  { value: "AzubiSupervisor", label: "Supervisors" },
] as const;

const SUBJECT_COLOR: Record<string, string> = {
  AzubiApplication: "#1668e3",
  AzubiOrganization: "#0f766e",
  AzubiSupervisor: "#a16207",
};

const selectClass =
  "h-[38px] font-body text-sm text-text bg-bg border border-neutral-300 rounded-md px-3 outline-none hover:border-neutral-400 focus-visible:border-accent";

export default async function AzubiActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ subjectType?: string; performedBy?: string; from?: string; to?: string; cursor?: string }>;
}) {
  const { subjectType, performedBy, from, to, cursor } = await searchParams;
  const [{ items, nextCursor }, staffOptions] = await Promise.all([
    listAzubiActivityLog({ subjectType, performedBy, from, to, cursor }),
    listAzubiAssignableStaff(),
  ]);

  const paramsWithout = (omit: "cursor") => {
    const p = new URLSearchParams();
    if (subjectType) p.set("subjectType", subjectType);
    if (performedBy) p.set("performedBy", performedBy);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (omit !== "cursor" && cursor) p.set("cursor", cursor);
    return p;
  };

  return (
    <div className="max-w-[1000px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation</div>
      <h1 className="font-heading text-2xl mt-0.5">Activity log</h1>
      <AzubiAdminTabs />

      <div className="flex items-center justify-between flex-wrap gap-[var(--space-3)] mb-[var(--space-3)]">
        <div className="flex gap-1 flex-wrap">
          {SUBJECT_TYPES.map((s) => {
            const p = paramsWithout("cursor");
            if (s.value) p.set("subjectType", s.value);
            else p.delete("subjectType");
            const href = `/admin/azubi/activity-log${p.toString() ? `?${p.toString()}` : ""}`;
            const active = (subjectType ?? undefined) === s.value;
            return (
              <Link
                key={s.label}
                href={href}
                className={`inline-flex items-center rounded-md px-3 py-1.5 text-[12.5px] font-medium no-underline ${
                  active ? "bg-accent-100 text-accent-700" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
        {/* A CSV download (Content-Disposition: attachment), not page navigation — plain <a> is correct here. */}
        <a
          href={`/api/exports/azubi-activity-log${paramsWithout("cursor").toString() ? `?${paramsWithout("cursor").toString()}` : ""}`}
          className={buttonClassName("secondary")}
        >
          Export CSV
        </a>
      </div>

      <form method="GET" className="flex items-center gap-2 flex-wrap mb-[var(--space-4)]">
        {subjectType && <input type="hidden" name="subjectType" value={subjectType} />}
        <select name="performedBy" defaultValue={performedBy ?? ""} className={selectClass}>
          <option value="">Anyone</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={from ?? ""} className={selectClass} aria-label="From date" />
        <input type="date" name="to" defaultValue={to ?? ""} className={selectClass} aria-label="To date" />
        <button type="submit" className={buttonClassName("secondary")}>
          Filter
        </button>
      </form>

      {items.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No activity in this range</div>
        </div>
      ) : (
        <>
          <div className="border border-divider rounded-md divide-y divide-divider">
            {items.map((e) => (
              <div key={e.id.toString()} className="flex items-start gap-3 px-[var(--space-4)] py-[var(--space-3)]">
                <span
                  className="mt-[5px] flex-none w-[7px] h-[7px] rounded-full"
                  style={{ backgroundColor: SUBJECT_COLOR[e.subjectType] ?? "#94a3b8" }}
                />
                <div>
                  <div className="text-[13px]">{e.description}</div>
                  <div className="text-[11px] text-neutral-500 mt-[2px]">
                    {e.actor?.name ?? "System"} · {e.action} ·{" "}
                    {new Date(e.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {nextCursor && (
            <div className="mt-[var(--space-4)] text-center">
              <Link
                href={`/admin/azubi/activity-log?${(() => {
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
