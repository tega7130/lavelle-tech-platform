import type { getCandidateAuditEvents } from "@/lib/candidate-admin-reads";

type AuditEvents = Awaited<ReturnType<typeof getCandidateAuditEvents>>;

export function CandidateAuditLogTab({ events }: { events: AuditEvents }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 px-6 border border-divider rounded-md">
        <div className="font-heading font-semibold text-[15px]">No audit entries for this candidate</div>
      </div>
    );
  }

  return (
    <div className="border border-divider rounded-md divide-y divide-divider">
      {events.map((e) => (
        <div key={e.id.toString()} className="px-[var(--space-4)] py-[var(--space-3)]">
          <div className="text-[13px]">{e.description}</div>
          <div className="text-[11px] text-neutral-500 mt-[2px]">
            {e.actor?.name ?? "System"} · {new Date(e.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </div>
      ))}
    </div>
  );
}
