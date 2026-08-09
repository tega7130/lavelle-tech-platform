import Link from "next/link";
import { requireStaffSession } from "@/lib/staff-auth";
import { getAdminOverview, getRecentActivity } from "@/lib/admin-overview-reads";
import { formatNaira } from "@/lib/format";
import { Card, CardKicker } from "@/components/ui/card";

export default async function AdminOverviewPage() {
  const user = await requireStaffSession();
  const permissions = new Set(user.permissions);
  const [overview, activity] = await Promise.all([getAdminOverview(permissions), getRecentActivity(10)]);

  const kpis = [
    { label: "Candidates", value: overview.candidateCount.toLocaleString() },
    { label: "Active enrolments", value: overview.activeEnrolmentCount.toLocaleString() },
    ...(overview.financeThisMonthMinor !== null
      ? [{ label: "Collected · this month", value: formatNaira(overview.financeThisMonthMinor) }]
      : []),
    ...(overview.markingQueueCount !== null
      ? [{ label: "Awaiting marking", value: overview.markingQueueCount.toLocaleString() }]
      : []),
  ];

  return (
    <div className="max-w-[1280px]">
      <h1 className="font-heading text-2xl mb-[var(--space-4)]">Overview</h1>

      <div className="grid grid-cols-4 gap-[var(--space-4)] mb-[var(--space-6)]">
        {kpis.map((k) => (
          <Card key={k.label} elev="sm">
            <CardKicker>{k.label}</CardKicker>
            <div className="font-heading font-bold text-[26px] mt-1">{k.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-6)]">
        <div>
          <h3 className="mb-[var(--space-3)]">Needs attention</h3>
          {overview.attentionQueue.length === 0 ? (
            <div className="text-center py-10 border border-divider rounded-md text-neutral-500 text-sm">
              Nothing needs attention right now.
            </div>
          ) : (
            <div className="border border-divider rounded-md divide-y divide-divider">
              {overview.attentionQueue.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] no-underline text-text hover:bg-neutral-100"
                >
                  <span className="text-[13.5px]">{item.label}</span>
                  <span className="inline-flex items-center rounded-full text-[12px] font-medium px-[9px] py-[2px] bg-accent-100 text-accent-700">
                    {item.count}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-[var(--space-3)]">Recent activity</h3>
          {activity.length === 0 ? (
            <div className="text-center py-10 border border-divider rounded-md text-neutral-500 text-sm">
              No activity recorded yet.
            </div>
          ) : (
            <div className="border border-divider rounded-md divide-y divide-divider">
              {activity.map((event) => (
                <div key={event.id.toString()} className="px-[var(--space-4)] py-[var(--space-3)]">
                  <div className="text-[13px]">{event.description}</div>
                  <div className="text-[11px] text-neutral-500 mt-[2px]">
                    {event.actor?.name ?? "System"} · {new Date(event.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
