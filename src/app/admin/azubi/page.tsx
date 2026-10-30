import Link from "next/link";
import { getAzubiOverview } from "@/lib/azubi-reads";
import { AzubiAdminTabs } from "@/components/admin/azubi/azubi-admin-tabs";

export default async function AzubiOverviewPage() {
  const { newApplications, newEnquiries, latestApplications, latestEnquiries } = await getAzubiOverview();

  return (
    <div className="max-w-[1100px]">
      <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">Azubi Foundation</div>
      <h1 className="font-heading text-2xl mt-0.5 mb-[var(--space-4)]">Overview</h1>
      <AzubiAdminTabs />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)] mb-[var(--space-6)]">
        <Link
          href="/admin/azubi/applications?pipelineStatus=NEW"
          className="block rounded-md border border-divider p-[var(--space-4)] no-underline hover:border-accent-300"
        >
          <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">New applications</div>
          <div className="font-heading text-3xl mt-1 text-text">{newApplications}</div>
        </Link>
        <Link
          href="/admin/azubi/enquiries?status=NEW"
          className="block rounded-md border border-divider p-[var(--space-4)] no-underline hover:border-accent-300"
        >
          <div className="text-[11px] tracking-[0.08em] uppercase text-neutral-500">New enquiries</div>
          <div className="font-heading text-3xl mt-1 text-text">{newEnquiries}</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
        <section>
          <div className="flex items-center justify-between mb-[var(--space-2)]">
            <h2 className="font-heading text-base">Latest applications</h2>
            <Link href="/admin/azubi/applications" className="text-[12.5px] text-accent no-underline hover:underline">
              View all
            </Link>
          </div>
          <ul className="flex flex-col gap-[var(--space-2)]">
            {latestApplications.length === 0 && <li className="text-[13px] text-neutral-600">No applications yet.</li>}
            {latestApplications.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/azubi/applications/${a.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-divider px-[var(--space-3)] py-[var(--space-2)] no-underline hover:bg-neutral-100"
                >
                  <span className="text-[13px] text-text truncate">{a.fullName}</span>
                  <span className="text-[11px] text-neutral-500 flex-none">{a.pipelineStatus}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="flex items-center justify-between mb-[var(--space-2)]">
            <h2 className="font-heading text-base">Latest enquiries</h2>
            <Link href="/admin/azubi/enquiries" className="text-[12.5px] text-accent no-underline hover:underline">
              View all
            </Link>
          </div>
          <ul className="flex flex-col gap-[var(--space-2)]">
            {latestEnquiries.length === 0 && <li className="text-[13px] text-neutral-600">No enquiries yet.</li>}
            {latestEnquiries.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/admin/azubi/enquiries/${e.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-divider px-[var(--space-3)] py-[var(--space-2)] no-underline hover:bg-neutral-100"
                >
                  <span className="text-[13px] text-text truncate">{e.fullName}</span>
                  <span className="text-[11px] text-neutral-500 flex-none">{e.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
