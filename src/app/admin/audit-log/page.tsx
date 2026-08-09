import Link from "next/link";
import { listAuditEvents } from "@/lib/staff-reads";
import { buttonClassName } from "@/components/ui/button";

const CATEGORIES = [
  { value: undefined, label: "All" },
  { value: "candidate", label: "Candidates" },
  { value: "staff", label: "Staff" },
  { value: "certificate", label: "Certificates" },
  { value: "enrolment", label: "Enrolments" },
  { value: "payment", label: "Payments" },
  { value: "announcement", label: "Announcements" },
  { value: "support_request", label: "Support" },
] as const;

const CATEGORY_COLOR: Record<string, string> = {
  candidate: "#1668e3",
  staff: "#0c356f",
  certificate: "#0f766e",
  enrolment: "#a16207",
  payment: "#a16207",
  announcement: "#6d28d9",
  support_request: "#475569",
};

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ category?: string; cursor?: string }> }) {
  const { category, cursor } = await searchParams;
  const { items: events, nextCursor } = await listAuditEvents({ category, cursor });

  return (
    <div className="max-w-[900px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Audit log</h1>

      <div className="flex gap-1 mb-[var(--space-4)] flex-wrap">
        {CATEGORIES.map((c) => {
          const href = c.value ? `/admin/audit-log?category=${c.value}` : "/admin/audit-log";
          const active = (category ?? undefined) === c.value;
          return (
            <Link
              key={c.label}
              href={href}
              className={`inline-flex items-center rounded-md px-3 py-1.5 text-[12.5px] font-medium no-underline ${
                active ? "bg-accent-100 text-accent-700" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 border border-divider rounded-md">
          <div className="font-heading font-semibold text-[15px]">No audit entries in this range</div>
        </div>
      ) : (
        <>
          <div className="border border-divider rounded-md divide-y divide-divider">
            {events.map((e) => {
              const cat = e.action.split(".")[0];
              return (
                <div key={e.id.toString()} className="flex items-start gap-3 px-[var(--space-4)] py-[var(--space-3)]">
                  <span
                    className="mt-[5px] flex-none w-[7px] h-[7px] rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[cat] ?? "#94a3b8" }}
                  />
                  <div>
                    <div className="text-[13px]">{e.description}</div>
                    <div className="text-[11px] text-neutral-500 mt-[2px]">
                      {e.actor?.name ?? "System"} · {e.action} ·{" "}
                      {new Date(e.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {nextCursor && (
            <div className="mt-[var(--space-4)] text-center">
              <Link
                href={`/admin/audit-log?${category ? `category=${category}&` : ""}cursor=${nextCursor}`}
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
